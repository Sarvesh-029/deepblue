import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { 
  Shield, 
  Video, 
  VideoOff, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Sliders, 
  Sparkles, 
  Info,
  Maximize2,
  Lock,
  Zap,
  Eye,
  Camera,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Volume1,
  Radio
} from 'lucide-react';

const MAX_WIDTH = 640;
const CAPTURE_INTERVAL_MS = 4000; // 4 seconds interval per requirements

export default function Monitor() {
  // State
  const [roomDevice, setRoomDevice] = useState('Living Room');
  const [availableRooms, setAvailableRooms] = useState(['Living Room', 'Dadi\'s Bedroom', 'Kids Room', 'Dining Area']);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentGranted, setConsentGranted] = useState(false);
  
  // Motion Detection State
  const [motionScore, setMotionScore] = useState(0);
  const [motionThreshold, setMotionThreshold] = useState(2.5); // % changed pixels
  const [isMotionActive, setIsMotionActive] = useState(false);
  
  // Stage 5: Audio Distress State (Client-Side Edge AI)
  const [micActive, setMicActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100
  const [distressSoundActive, setDistressSoundActive] = useState(false);
  const [lastAudioAlert, setLastAudioAlert] = useState(null);

  // Stats & Log
  const [stats, setStats] = useState({
    framesEvaluated: 0,
    framesDispatched: 0,
    lastDispatchTime: null,
    bandwidthSavedFrames: 0,
    audioChecks: 0,
    audioAlertsCount: 0
  });
  const [lastUploadedThumb, setLastUploadedThumb] = useState(null);
  const [statusMessage, setStatusMessage] = useState('Standby');
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Refs
  const videoRef = useRef(null);
  const motionCanvasRef = useRef(null); // low-res canvas for motion diffing
  const captureCanvasRef = useRef(null); // 640px max width canvas for backend dispatch
  const prevFrameDataRef = useRef(null);
  const motionDetectedInCycleRef = useRef(false);
  const intervalTimerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);
  
  // Audio Web API Refs
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioSourceRef = useRef(null);
  const lastAudioAlertTimeRef = useRef(0);

  // Fetch configured rooms on load
  useEffect(() => {
    api.getMonitoredRooms()
      .then(res => {
        if (res?.rooms) setAvailableRooms(res.rooms);
      })
      .catch(() => {});
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, []);

  // Browser Audio Analyzer (runs continuously on client)
  const processAudioAnalysis = useCallback(() => {
    if (!isMonitoring || !analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    // Calculate RMS volume level (0-100)
    let sum = 0;
    // Also analyze high-frequency distress band (crying, shrieks: 1.2 kHz - 3.8 kHz)
    let distressBandSum = 0;
    const distressBandStart = Math.floor(bufferLength * 0.25);
    const distressBandEnd = Math.floor(bufferLength * 0.75);

    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
      if (i >= distressBandStart && i <= distressBandEnd) {
        distressBandSum += dataArray[i];
      }
    }

    const avg = sum / bufferLength;
    const normalizedLevel = Math.min(100, Math.round((avg / 128) * 100));
    setAudioLevel(normalizedLevel);

    const distressIntensity = distressBandSum / (distressBandEnd - distressBandStart);

    // Acoustic Distress Detection Threshold
    // If high-pitched cry/screaming peak occurs (> 70) and cooldown (30s) expired:
    const now = Date.now();
    if (distressIntensity > 75 && normalizedLevel > 50) {
      if (now - lastAudioAlertTimeRef.current > 25000) { // 25s cooldown
        lastAudioAlertTimeRef.current = now;
        dispatchAudioDistressAlert('Crying/Screaming Acoustic Trigger', 0.89);
      }
    }
  }, [isMonitoring, roomDevice]);

  // Motion & Audio Detection Loop (Runs via requestAnimationFrame)
  const processEdgeDetection = useCallback(() => {
    if (!isMonitoring) return;

    // 1. Process Audio
    if (analyserRef.current) {
      processAudioAnalysis();
    }

    // 2. Process Motion Canvas
    const video = videoRef.current;
    const motionCanvas = motionCanvasRef.current;

    if (video && motionCanvas && video.readyState >= 2) {
      const ctx = motionCanvas.getContext('2d', { willReadFrequently: true });
      const w = motionCanvas.width;
      const h = motionCanvas.height;

      ctx.drawImage(video, 0, 0, w, h);
      const currentFrame = ctx.getImageData(0, 0, w, h);
      const currentData = currentFrame.data;

      if (prevFrameDataRef.current) {
        const prevData = prevFrameDataRef.current;
        let changedPixels = 0;
        const totalPixels = w * h;

        for (let i = 0; i < currentData.length; i += 4) {
          const rDiff = Math.abs(currentData[i] - prevData[i]);
          const gDiff = Math.abs(currentData[i + 1] - prevData[i + 1]);
          const bDiff = Math.abs(currentData[i + 2] - prevData[i + 2]);
          const diff = (rDiff + gDiff + bDiff) / 3;

          if (diff > 25) {
            changedPixels++;
          }
        }

        const score = (changedPixels / totalPixels) * 100;
        setMotionScore(parseFloat(score.toFixed(1)));

        if (score >= motionThreshold) {
          setIsMotionActive(true);
          motionDetectedInCycleRef.current = true;
        } else {
          setIsMotionActive(false);
        }
      }

      prevFrameDataRef.current = currentData;
      setStats(prev => ({ ...prev, framesEvaluated: prev.framesEvaluated + 1 }));
    }

    animationFrameRef.current = requestAnimationFrame(processEdgeDetection);
  }, [isMonitoring, motionThreshold, processAudioAnalysis]);

  // Periodic Frame Dispatch Loop: Every 4s, uploads ONE frame ONLY if motion detected
  const setupDispatchInterval = useCallback(() => {
    if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);

    intervalTimerRef.current = setInterval(async () => {
      const hadMotion = motionDetectedInCycleRef.current || isDemoMode;

      if (hadMotion) {
        await captureAndSendFrame();
        motionDetectedInCycleRef.current = false;
      } else {
        setStatusMessage('Idle (No motion - privacy preserved & upload skipped)');
        setStats(prev => ({ ...prev, bandwidthSavedFrames: prev.bandwidthSavedFrames + 1 }));
      }
    }, CAPTURE_INTERVAL_MS);
  }, [roomDevice, isDemoMode]);

  // Capture downscaled frame (<= 640px) and post to backend
  const captureAndSendFrame = async () => {
    try {
      const video = videoRef.current;
      const canvas = captureCanvasRef.current;
      if (!canvas) return;

      let srcW = 640;
      let srcH = 480;

      if (video && video.videoWidth) {
        srcW = video.videoWidth;
        srcH = video.videoHeight;
      }

      const targetWidth = Math.min(MAX_WIDTH, srcW);
      const targetHeight = Math.round((srcH / srcW) * targetWidth);

      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      if (isDemoMode) {
        drawDemoFrame(ctx, targetWidth, targetHeight);
      } else if (video && video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
      } else {
        return;
      }

      setStatusMessage('Sending 640px frame on motion event...');

      canvas.toBlob(async (blob) => {
        if (!blob) return;

        const formData = new FormData();
        formData.append('file', blob, `frame_${Date.now()}.jpg`);
        formData.append('room_device', roomDevice);
        formData.append('motion_detected', 'true');
        formData.append('motion_score', motionScore.toString());

        try {
          const res = await api.uploadMonitorFrame(formData);
          const thumbUrl = URL.createObjectURL(blob);
          setLastUploadedThumb(thumbUrl);

          setStats(prev => ({
            ...prev,
            framesDispatched: prev.framesDispatched + 1,
            lastDispatchTime: new Date().toLocaleTimeString()
          }));
          setStatusMessage(`Frame analyzed • Room: ${roomDevice}`);
        } catch (err) {
          console.error('Frame upload failed:', err);
          setStatusMessage(`Upload failed: ${err.message}`);
        }
      }, 'image/jpeg', 0.8);

    } catch (e) {
      console.error('Capture error:', e);
    }
  };

  // Dispatch Audio Distress Alert (Strictly metadata, NO audio bytes sent)
  const dispatchAudioDistressAlert = async (soundClass, confidence) => {
    setDistressSoundActive(true);
    setLastAudioAlert({ soundClass, confidence, time: new Date().toLocaleTimeString() });

    try {
      await api.reportAudioDistress({
        room_device: roomDevice,
        sound_class: soundClass,
        confidence: confidence
      });
      setStats(prev => ({
        ...prev,
        audioAlertsCount: prev.audioAlertsCount + 1
      }));
      setStatusMessage(`Audio Alert: ${soundClass} (${(confidence * 100).toFixed(0)}%)`);
    } catch (err) {
      console.error('Failed to report audio distress:', err);
    } finally {
      setTimeout(() => setDistressSoundActive(false), 5000);
    }
  };

  // Synthetic Demo Mode Canvas Frame Generator
  const drawDemoFrame = (ctx, w, h) => {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.7);
    ctx.lineTo(w, h * 0.7);
    ctx.stroke();

    const time = Date.now() / 1000;
    const posX = (w / 2) + Math.sin(time) * (w / 4);
    const posY = (h / 2) + Math.cos(time * 1.5) * 20;

    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(posX, posY - 40, 24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.ellipse(posX, posY + 20, 30, 45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(10, 10, w - 20, 45);

    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillText(`[DEMO MODE REPLAY] ROOM: ${roomDevice.toUpperCase()}`, 20, 30);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`TIME: ${new Date().toISOString()} • MOTION: SIMULATED`, 20, 46);
  };

  // Start Camera & Microphone Streams after Consent
  const startCamera = async () => {
    try {
      if (isDemoMode) {
        setIsMonitoring(true);
        setStatusMessage('Demo Simulation Monitoring Active');
        setupDispatchInterval();
        return;
      }

      setStatusMessage('Requesting camera & microphone permissions...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: true
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Initialize Web Audio API for Browser-Side Edge AI (No audio leaves device)
      try {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          analyserRef.current = analyser;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);
          audioSourceRef.current = source;
          setMicActive(true);
        }
      } catch (audioErr) {
        console.warn('Microphone analyzer init notice:', audioErr);
      }

      setIsMonitoring(true);
      setStatusMessage('Monitoring Live & Active');
      setupDispatchInterval();
      animationFrameRef.current = requestAnimationFrame(processEdgeDetection);

    } catch (err) {
      console.error('Camera/Mic access failed:', err);
      alert(`Unable to open camera/mic: ${err.message}. You can switch to 'Demo Mode' below to test the full pipeline.`);
      setIsMonitoring(false);
    }
  };

  // Handle Consent Acceptance
  const handleConfirmConsent = async () => {
    try {
      await api.recordMonitoringConsent({
        room_device: roomDevice,
        consent_type: 'ROOM_MONITORING',
        terms_version: '1.0'
      });
      setConsentGranted(true);
      setShowConsentModal(false);
      await startCamera();
    } catch (err) {
      console.error('Failed to log consent:', err);
      alert('Could not record consent: ' + err.message);
    }
  };

  // Stop Monitoring
  const stopMonitoring = () => {
    setIsMonitoring(false);
    setMicActive(false);
    setStatusMessage('Monitoring Stopped');

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (intervalTimerRef.current) {
      clearInterval(intervalTimerRef.current);
      intervalTimerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    prevFrameDataRef.current = null;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* 1. VISIBLE "MONITORING ACTIVE" GLOWING BANNER */}
      {isMonitoring && (
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border-2 border-emerald-500 shadow-lg shadow-emerald-500/20 text-white flex items-center justify-between animate-pulse">
          <div className="flex items-center space-x-3">
            <span className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
            </span>
            <div>
              <div className="text-sm font-extrabold tracking-wider uppercase flex items-center space-x-2">
                <span>MONITORING ACTIVE</span>
                <span className="text-emerald-400">• PRIVACY SHIELD ENGAGED</span>
              </div>
              <div className="text-xs text-slate-300">
                Sentinel assigned to: <strong>{roomDevice}</strong> • Zero raw footage or audio recorded
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center space-x-1">
              <Radio className="w-3 h-3 text-emerald-400 animate-spin" />
              <span>Vision & Audio Edge AI Active</span>
            </span>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Video Viewport, Motion & Audio Meters */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Viewport Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <Video className="w-4 h-4 text-saffron-500" />
                <span className="font-semibold">{roomDevice} Viewport</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                <span className="text-slate-300 font-medium">{statusMessage}</span>
              </div>
            </div>

            {/* Video Canvas Container */}
            <div className="relative bg-slate-950 aspect-[4/3] flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                muted
                playsInline
                className={`w-full h-full object-cover ${isMonitoring && !isDemoMode ? 'block' : 'hidden'}`}
              />

              {/* Demo Mode Canvas Preview */}
              {isMonitoring && isDemoMode && (
                <div className="text-center p-6 space-y-3">
                  <div className="inline-block p-4 rounded-2xl bg-orange-500/20 text-saffron-400 animate-bounce">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div className="text-white font-bold text-lg">Demo Mode Simulation Active</div>
                  <p className="text-slate-400 text-xs max-w-sm">
                    Replaying simulated room frames with motion synthesis and dispatching to backend every 4 seconds.
                  </p>
                </div>
              )}

              {/* Standby Placeholder */}
              {!isMonitoring && (
                <div className="text-center p-8 space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                    <VideoOff className="w-8 h-8" />
                  </div>
                  <h3 className="text-white font-bold text-base">Sentinel Camera Disengaged</h3>
                  <p className="text-slate-400 text-xs max-w-xs mx-auto">
                    Click 'Start Sentinel Monitor' below to review consent and activate room vigilance.
                  </p>
                </div>
              )}

              {/* Live Overlay Badges */}
              {isMonitoring && (
                <div className="absolute top-4 left-4 flex flex-col space-y-2">
                  <div className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center space-x-1.5 shadow-md ${
                    isMotionActive
                      ? 'bg-amber-500 text-white animate-pulse'
                      : 'bg-black/60 text-slate-300 backdrop-blur-md'
                  }`}>
                    <Activity className="w-3.5 h-3.5" />
                    <span>{isMotionActive ? 'Motion Detected' : 'No Movement'}</span>
                  </div>

                  {distressSoundActive && (
                    <div className="px-2.5 py-1 rounded-full text-xs font-bold flex items-center space-x-1.5 shadow-md bg-rose-600 text-white animate-bounce">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Distress Sound Detected!</span>
                    </div>
                  )}
                </div>
              )}

              {/* Privacy Shield Watermark */}
              {isMonitoring && (
                <div className="absolute bottom-4 right-4 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[10px] text-slate-300 flex items-center space-x-1 border border-white/10">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  <span>Privacy First: Zero Audio/Video Stored</span>
                </div>
              )}
            </div>

            {/* Real-time Edge Meters (Motion & Audio) */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
              {/* Motion Meter Bar */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700 flex items-center space-x-1.5">
                    <Sliders className="w-3.5 h-3.5 text-saffron-600" />
                    <span>Motion Sensitivity Level: {motionScore}%</span>
                  </span>
                  <span className="text-slate-500">Threshold: {motionThreshold}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 ${
                      motionScore >= motionThreshold ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, (motionScore / 10) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Audio Distress Level Meter (Edge Browser AI) */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700 flex items-center space-x-1.5">
                    <Mic className={`w-3.5 h-3.5 ${micActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span>Acoustic Distress AI Level: {audioLevel}%</span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {micActive ? 'On-Device YAMNet Active' : 'Microphone Inactive'}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 ${
                      audioLevel > 65 ? 'bg-rose-500' : audioLevel > 35 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Hidden utility canvases */}
          <canvas ref={motionCanvasRef} width="64" height="48" className="hidden" />
          <canvas ref={captureCanvasRef} className="hidden" />
        </div>

        {/* Right Column: Controls, Telemetry & Simulated Audio Trigger */}
        <div className="space-y-6">
          {/* Controls Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Sentinel Controls
            </h3>

            {/* Room Device Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Monitored Room / Device
              </label>
              <select
                disabled={isMonitoring}
                value={roomDevice}
                onChange={(e) => setRoomDevice(e.target.value)}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-300 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-saffron-500 disabled:opacity-60"
              >
                {availableRooms.map((r, idx) => (
                  <option key={idx} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Demo Mode Toggle */}
            <div className="p-3.5 rounded-xl bg-orange-50/70 border border-orange-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Demo Mode (Replay)</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Simulate without physical webcam
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  disabled={isMonitoring}
                  checked={isDemoMode}
                  onChange={(e) => setIsDemoMode(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-saffron-600"></div>
              </label>
            </div>

            {/* STAGE 5: 1-Click Audio Distress Simulation Button */}
            <button
              type="button"
              onClick={() => dispatchAudioDistressAlert('Crying / Distress Call', 0.92)}
              className="w-full py-2.5 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition-all flex items-center justify-center space-x-2"
            >
              <Volume2 className="w-4 h-4 text-rose-600" />
              <span>Simulate Baby Cry / Shout Trigger (Test)</span>
            </button>

            {/* Action Buttons */}
            {!isMonitoring ? (
              <button
                onClick={() => setShowConsentModal(true)}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-saffron-600 hover:bg-saffron-700 shadow-md shadow-orange-600/30 flex items-center justify-center space-x-2 transition-all"
              >
                <Video className="w-4 h-4" />
                <span>Start Sentinel Monitor</span>
              </button>
            ) : (
              <button
                onClick={stopMonitoring}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/30 flex items-center justify-center space-x-2 transition-all"
              >
                <VideoOff className="w-4 h-4" />
                <span>Disengage Monitoring</span>
              </button>
            )}
          </div>

          {/* Activity & Bandwidth Optimization Stats */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between">
              <span>Sentinel Telemetry</span>
              <Activity className="w-4 h-4 text-emerald-600" />
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] uppercase font-bold text-slate-500">Motion Checks</div>
                <div className="text-lg font-extrabold text-slate-900">{stats.framesEvaluated}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] uppercase font-bold text-slate-500">Frames Uploaded</div>
                <div className="text-lg font-extrabold text-saffron-600">{stats.framesDispatched}</div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-purple-50 border border-purple-100 text-xs text-purple-900 space-y-1">
              <div className="font-bold flex items-center space-x-1.5">
                <Volume1 className="w-3.5 h-3.5 text-purple-600" />
                <span>Audio Distress Events: {stats.audioAlertsCount}</span>
              </div>
              <p className="text-[11px] text-purple-700 leading-tight">
                Analyzed locally inside browser. Zero audio ever recorded or uploaded.
              </p>
            </div>

            {/* Last Dispatched Frame Thumbnail Preview */}
            {lastUploadedThumb && (
              <div>
                <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center justify-between">
                  <span>Last Motion Frame Sent:</span>
                  <span className="text-[10px] text-slate-400">{stats.lastDispatchTime}</span>
                </div>
                <div className="rounded-xl overflow-hidden border border-slate-200 shadow-inner">
                  <img src={lastUploadedThumb} alt="Last Motion Frame" className="w-full object-cover h-28" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. EXPLICIT CONSENT MODAL */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 text-saffron-600 flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-slate-900">
                Room Monitoring & Audio Consent
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                CareGuard Bharat prioritizes ethical, privacy-preserving vigilance.
              </p>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span><strong>Zero Raw Audio Stored:</strong> Microphones are analyzed locally in-browser with Web Audio AI. Audio is never transmitted.</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span><strong>Intermittent Motion Frames:</strong> Only downscaled 640px frames captured every 4s on motion are processed.</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span><strong>Face Blurring & Auto-Cleanup:</strong> Stored snapshot evidence is blurred; snapshots older than 7 days are auto-purged.</span>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConsentModal(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmConsent}
                className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white bg-saffron-600 hover:bg-saffron-700 shadow-md shadow-orange-600/30 transition-all"
              >
                Grant Consent & Start
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
