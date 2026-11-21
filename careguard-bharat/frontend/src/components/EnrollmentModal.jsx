import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Shield, 
  Camera, 
  Upload, 
  CheckCircle, 
  X, 
  AlertCircle, 
  Clock, 
  User, 
  HeartHandshake, 
  Home, 
  Baby,
  Sparkles
} from 'lucide-react';

export default function EnrollmentModal({ isOpen, onClose, onEnrolled }) {
  const [name, setName] = useState('');
  const [roleType, setRoleType] = useState('dependent');
  const [shiftStart, setShiftStart] = useState('09:00');
  const [shiftEnd, setShiftEnd] = useState('18:00');
  const [notes, setNotes] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [signedBy, setSignedBy] = useState('');

  // Photo mode: 'camera' or 'file'
  const [photoMode, setPhotoMode] = useState('camera');
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && photoMode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, photoMode]);

  const startCamera = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 480 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      console.warn('Camera open failed in modal, switching to file upload:', err);
      setCameraActive(false);
      setPhotoMode('file');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhotoFromVideo = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        setCapturedBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        stopCamera();
      }
    }, 'image/jpeg', 0.9);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCapturedBlob(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const resetPhoto = () => {
    setCapturedBlob(null);
    setPreviewUrl(null);
    if (photoMode === 'camera') {
      startCamera();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!consentAccepted) {
      setError('Explicit consent must be acknowledged before submitting facial biometric data.');
      return;
    }

    if (!capturedBlob) {
      setError('Please provide a portrait photo for biometric enrollment.');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('name', name);
    formData.append('role_type', roleType);
    formData.append('consent_given', 'true');
    formData.append('consent_signed_by', signedBy || name);
    formData.append('notes', notes);
    if (roleType === 'caregiver') {
      formData.append('shift_start', shiftStart);
      formData.append('shift_end', shiftEnd);
    }
    formData.append('photo', capturedBlob, 'enrollment_portrait.jpg');

    try {
      await api.enrollPerson(formData);
      onEnrolled();
      onClose();
    } catch (err) {
      setError(err.message || 'Enrollment failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 my-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 text-saffron-600 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Enroll Face With Consent</h2>
              <p className="text-xs text-slate-500">Extracts 128-d SFace vector • Never stores raw photo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Role Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Select Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRoleType('dependent')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  roleType === 'dependent'
                    ? 'border-saffron-500 bg-orange-50/60 ring-2 ring-saffron-500/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <Baby className={`w-5 h-5 mx-auto mb-1 ${roleType === 'dependent' ? 'text-saffron-600' : 'text-slate-400'}`} />
                <div className="text-xs font-bold text-slate-900">Dependent</div>
                <div className="text-[10px] text-slate-500">Elderly / Infant</div>
              </button>

              <button
                type="button"
                onClick={() => setRoleType('caregiver')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  roleType === 'caregiver'
                    ? 'border-saffron-500 bg-orange-50/60 ring-2 ring-saffron-500/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <HeartHandshake className={`w-5 h-5 mx-auto mb-1 ${roleType === 'caregiver' ? 'text-saffron-600' : 'text-slate-400'}`} />
                <div className="text-xs font-bold text-slate-900">Caregiver</div>
                <div className="text-[10px] text-slate-500">Nurse / Ayah</div>
              </button>

              <button
                type="button"
                onClick={() => setRoleType('family')}
                className={`p-3 rounded-xl border text-center transition-all ${
                  roleType === 'family'
                    ? 'border-saffron-500 bg-orange-50/60 ring-2 ring-saffron-500/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <Home className={`w-5 h-5 mx-auto mb-1 ${roleType === 'family' ? 'text-saffron-600' : 'text-slate-400'}`} />
                <div className="text-xs font-bold text-slate-900">Family</div>
                <div className="text-[10px] text-slate-500">Authorized Kin</div>
              </button>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dadi, Nurse Sunita, Ramesh"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-saffron-500"
            />
          </div>

          {/* Caregiver Shift Setup */}
          {roleType === 'caregiver' && (
            <div className="p-4 rounded-2xl bg-orange-50/60 border border-orange-200 space-y-3">
              <div className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-saffron-600" />
                <span>Caregiver Shift Schedule</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Shift Start
                  </label>
                  <input
                    type="time"
                    value={shiftStart}
                    onChange={(e) => setShiftStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Shift End
                  </label>
                  <input
                    type="time"
                    value={shiftEnd}
                    onChange={(e) => setShiftEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-500">
                A background scheduler (Stage 5) checks if caregiver is recognized within 30 minutes of shift start.
              </p>
            </div>
          )}

          {/* Photo Capture Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Facial Biometric Portrait
              </label>
              <div className="flex items-center space-x-1 text-xs">
                <button
                  type="button"
                  onClick={() => { setPhotoMode('camera'); resetPhoto(); }}
                  className={`px-2.5 py-1 rounded-lg ${photoMode === 'camera' ? 'bg-orange-100 text-saffron-700 font-bold' : 'text-slate-500'}`}
                >
                  Webcam
                </button>
                <button
                  type="button"
                  onClick={() => { setPhotoMode('file'); resetPhoto(); }}
                  className={`px-2.5 py-1 rounded-lg ${photoMode === 'file' ? 'bg-orange-100 text-saffron-700 font-bold' : 'text-slate-500'}`}
                >
                  Upload File
                </button>
              </div>
            </div>

            <div className="relative border-2 border-dashed border-slate-300 rounded-2xl p-4 text-center bg-slate-50 overflow-hidden flex flex-col items-center justify-center min-h-[200px]">
              {previewUrl ? (
                <div className="relative">
                  <img src={previewUrl} alt="Portrait Preview" className="w-40 h-40 object-cover rounded-2xl shadow-md border-2 border-white" />
                  <button
                    type="button"
                    onClick={resetPhoto}
                    className="mt-2 px-3 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-xs font-medium text-slate-700"
                  >
                    Retake / Choose Another
                  </button>
                </div>
              ) : photoMode === 'camera' ? (
                <div className="w-full flex flex-col items-center space-y-3">
                  <div className="relative w-48 h-48 rounded-2xl overflow-hidden bg-black shadow-inner">
                    <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                    <div className="absolute inset-0 border-2 border-orange-500/40 rounded-2xl pointer-events-none" />
                  </div>
                  <button
                    type="button"
                    onClick={capturePhotoFromVideo}
                    className="px-4 py-2 rounded-xl bg-saffron-600 text-white text-xs font-bold shadow-md hover:bg-saffron-700 flex items-center space-x-1.5"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Capture Portrait</span>
                  </button>
                </div>
              ) : (
                <div className="py-4">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-600 mb-2 font-medium">Upload clear front-facing portrait (JPG/PNG)</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-orange-100 file:text-saffron-700 hover:file:bg-orange-200 cursor-pointer"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Explicit Consent Guarantee */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <div className="font-bold text-slate-900 flex items-center space-x-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Explicit Consent & Privacy Disclosure</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              CareGuard Bharat generates a 128-dimensional mathematical embedding and strictly <strong>discards the raw photo</strong>. Consent is recorded in an immutable audit log.
            </p>
            <label className="flex items-start space-x-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-saffron-600 focus:ring-saffron-500"
              />
              <span className="text-slate-800 font-medium text-[11px]">
                I explicitly confirm that informed consent has been obtained from {name || 'this individual'} (or their legal guardian) to enroll their facial biometrics.
              </span>
            </label>
          </div>

          <div className="flex items-center space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !capturedBlob}
              className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white bg-saffron-600 hover:bg-saffron-700 shadow-md shadow-orange-600/30 transition-all disabled:opacity-50"
            >
              {loading ? 'Extracting Vector...' : 'Confirm Enrollment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
