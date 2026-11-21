import React from 'react';
import { ShieldCheck, X, EyeOff, Calendar, MapPin, AlertTriangle, Download, Lock } from 'lucide-react';

export default function SnapshotModal({ isOpen, onClose, snapshot, event }) {
  if (!isOpen || !snapshot) return null;

  const snapshotUrl = `/snapshots/${snapshot}`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 text-saffron-600 flex items-center justify-center">
              <EyeOff className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Blurred Evidence Inspection</h2>
              <p className="text-xs text-slate-500">Privacy Preserved • Gaussian Face Blur Applied</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Snapshot Image Display */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-200 shadow-inner mb-6">
          <img
            src={snapshotUrl}
            alt="Blurred Evidence Snapshot"
            className="w-full max-h-[420px] object-contain mx-auto"
          />
          <div className="absolute bottom-3 left-3 px-3 py-1 rounded-lg bg-black/70 backdrop-blur-md text-[11px] text-white flex items-center space-x-1.5 border border-white/10">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Face Region Anonymized Prior to Disk Storage</span>
          </div>
        </div>

        {/* Event Details Card */}
        {event && (
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3 mb-6 text-xs text-slate-700">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-slate-900">{event.event_type}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                event.severity === 'high' ? 'bg-orange-100 text-orange-800 border-orange-300' : 'bg-slate-200 text-slate-700 border-slate-300'
              }`}>
                {event.severity}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-slate-600">
              <div className="flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Room: <strong>{event.room_device}</strong></span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Time: <strong>{new Date(event.created_at).toLocaleString()}</strong></span>
              </div>
            </div>

            {event.details_json && (
              <div className="pt-2 border-t border-slate-200/60 text-[11px] font-mono text-slate-600 overflow-x-auto">
                Metadata: {typeof event.details_json === 'string' ? event.details_json : JSON.stringify(event.details_json)}
              </div>
            )}
          </div>
        )}

        {/* Privacy Guarantee Banner */}
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start space-x-2.5 mb-6">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            <strong>Privacy-by-Design Standard:</strong> This snapshot is mathematically irreversible. Even with full disk access, facial identities cannot be reconstructed. All snapshots are automatically purged after 7 days.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <a
            href={snapshotUrl}
            download={snapshot}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center space-x-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Download Blurred Frame</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
