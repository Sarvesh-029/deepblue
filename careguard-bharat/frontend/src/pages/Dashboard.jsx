import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import EnrollmentModal from '../components/EnrollmentModal';
import SnapshotModal from '../components/SnapshotModal';
import {
  ShieldCheck,
  Cpu,
  Database,
  Bell,
  HardDrive,
  EyeOff,
  Clock,
  Video,
  Users,
  CheckCircle,
  Activity,
  Layers,
  UserPlus,
  Trash2,
  Baby,
  HeartHandshake,
  Home,
  AlertTriangle,
  History,
  Sliders,
  AlertCircle,
  RefreshCw,
  CalendarClock,
  BarChart3,
  Camera,
  Siren,
  Filter,
  Save,
  XCircle,
  Edit3,
  Info,
  TrendingUp,
} from 'lucide-react';

// ── Event type filter constants ──────────────────────────────────────────────
const EVENT_TYPES = [
  { label: 'All Events', value: null },
  { label: 'Unknown Visitor', value: 'UNKNOWN_VISITOR' },
  { label: 'Unattended', value: 'DEPENDENT_UNATTENDED' },
  { label: 'Distress Sound', value: 'DISTRESS_SOUND' },
  { label: 'Caregiver Present', value: 'CAREGIVER_PRESENT' },
  { label: 'Caregiver Absent', value: 'CAREGIVER_ABSENT' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function getSeverityBadgeClass(severity) {
  switch (severity) {
    case 'critical': return 'bg-rose-100 text-rose-800 border-rose-300';
    case 'high':     return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'medium':   return 'bg-amber-100 text-amber-800 border-amber-300';
    default:         return 'bg-slate-100 text-slate-700 border-slate-300';
  }
}

function getRoleIcon(role) {
  switch (role) {
    case 'dependent': return <Baby className="w-4 h-4 text-purple-600" />;
    case 'caregiver': return <HeartHandshake className="w-4 h-4 text-orange-600" />;
    default:          return <Home className="w-4 h-4 text-blue-600" />;
  }
}

function getRoleBadgeClass(role) {
  switch (role) {
    case 'dependent': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'caregiver': return 'bg-orange-50 text-orange-700 border-orange-200';
    default:          return 'bg-blue-50 text-blue-700 border-blue-200';
  }
}

function getEventTypeIcon(type) {
  switch (type) {
    case 'UNKNOWN_VISITOR':      return <AlertTriangle className="w-4 h-4 text-rose-500" />;
    case 'DEPENDENT_UNATTENDED': return <Baby className="w-4 h-4 text-amber-500" />;
    case 'DISTRESS_SOUND':       return <Siren className="w-4 h-4 text-orange-500" />;
    case 'CAREGIVER_ABSENT':     return <XCircle className="w-4 h-4 text-red-500" />;
    case 'CAREGIVER_PRESENT':    return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    default:                     return <Info className="w-4 h-4 text-slate-400" />;
  }
}

// ── Stats Card ───────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color = 'orange' }) {
  const colorMap = {
    orange: 'bg-orange-50 text-saffron-600',
    blue:   'bg-sky-50 text-sky-600',
    purple: 'bg-purple-50 text-purple-600',
    green:  'bg-emerald-50 text-emerald-600',
  };
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <div className={`p-2 rounded-xl ${colorMap[color]}`}>{icon}</div>
      </div>
      <div className="text-2xl font-extrabold text-slate-900">{value ?? '—'}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

// ── Shift Editor (inline) ────────────────────────────────────────────────────
function ShiftEditor({ person, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [start, setStart]     = useState(person.shift_start || '');
  const [end, setEnd]         = useState(person.shift_end || '');
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');

  const handleSave = async () => {
    setSaving(true); setErr('');
    try {
      await api.updateCaregiverShift(person.id, {
        shift_start: start || null,
        shift_end:   end   || null,
        notes:       null,
      });
      setEditing(false);
      onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div
        className="mt-2 px-3 py-1.5 rounded-xl bg-orange-50/70 border border-orange-200 text-[11px] font-medium text-orange-800 flex items-center justify-between cursor-pointer hover:bg-orange-100 transition-colors"
        onClick={() => setEditing(true)}
        title="Click to edit shift"
      >
        <span className="flex items-center space-x-1">
          <CalendarClock className="w-3.5 h-3.5" />
          <span>Shift:</span>
        </span>
        <span className="font-bold flex items-center space-x-1.5">
          <span>{start || '—'} → {end || '—'}</span>
          <Edit3 className="w-3 h-3 text-orange-500" />
        </span>
      </div>
    );
  }

  return (
    <div className="mt-2 px-3 py-2 rounded-xl bg-orange-50 border border-orange-300 text-[11px] space-y-2">
      <div className="flex items-center space-x-2">
        <div className="flex-1">
          <label className="block text-orange-700 font-semibold mb-0.5">Start</label>
          <input
            type="time"
            value={start}
            onChange={e => setStart(e.target.value)}
            className="w-full px-2 py-1 rounded-lg border border-orange-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-saffron-400"
          />
        </div>
        <div className="flex-1">
          <label className="block text-orange-700 font-semibold mb-0.5">End</label>
          <input
            type="time"
            value={end}
            onChange={e => setEnd(e.target.value)}
            className="w-full px-2 py-1 rounded-lg border border-orange-300 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-saffron-400"
          />
        </div>
      </div>
      {err && <div className="text-rose-600 text-[10px]">{err}</div>}
      <div className="flex space-x-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-1.5 rounded-lg bg-saffron-600 hover:bg-saffron-700 text-white font-bold flex items-center justify-center space-x-1 transition-colors"
        >
          <Save className="w-3 h-3" />
          <span>{saving ? 'Saving…' : 'Save'}</span>
        </button>
        <button
          onClick={() => { setEditing(false); setStart(person.shift_start || ''); setEnd(person.shift_end || ''); }}
          className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 font-bold text-[10px] hover:bg-slate-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();

  // Core data
  const [healthData, setHealthData]       = useState(null);
  const [enrolledPersons, setEnrolledPersons] = useState([]);
  const [loadingPersons, setLoadingPersons]   = useState(true);
  const [stats, setStats]                 = useState(null);

  // Events + filter
  const [events, setEvents]               = useState([]);
  const [eventTypeFilter, setEventTypeFilter] = useState(null);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Presence + rules config
  const [presenceData, setPresenceData]   = useState([]);
  const [rulesConfig, setRulesConfig]     = useState({ unattended_minutes_threshold: 10 });
  const [updatingConfig, setUpdatingConfig] = useState(false);

  // Alerts panel
  const [alerts, setAlerts]               = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  // Modals
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [snapshotModal, setSnapshotModal]         = useState({ open: false, snapshot: null, event: null });

  // ── Fetch helpers ────────────────────────────────────────────────────────
  const fetchPersons = useCallback(() => {
    setLoadingPersons(true);
    api.listPersons()
      .then(d => setEnrolledPersons(d || []))
      .catch(e => console.error('persons:', e))
      .finally(() => setLoadingPersons(false));
  }, []);

  const fetchEvents = useCallback((typeFilter) => {
    setLoadingEvents(true);
    api.listEvents({ limit: 25, event_type: typeFilter })
      .then(res => setEvents(res?.events || []))
      .catch(e => console.error('events:', e))
      .finally(() => setLoadingEvents(false));
  }, []);

  const fetchAlerts = useCallback(() => {
    setLoadingAlerts(true);
    api.listAlerts({ limit: 20 })
      .then(res => setAlerts(Array.isArray(res) ? res : res?.alerts || []))
      .catch(e => console.error('alerts:', e))
      .finally(() => setLoadingAlerts(false));
  }, []);

  const fetchAll = useCallback(() => {
    // Health / adapters
    api.getHealth().then(d => setHealthData(d)).catch(console.error);

    // Stats summary
    api.getEventStats().then(d => setStats(d)).catch(e => console.error('stats:', e));

    // Caregiver presence (24 h window)
    api.getCaregiverPresence({ minutes: 1440 })
      .then(res => setPresenceData(res?.caregivers_summary || []))
      .catch(e => console.error('presence:', e));

    // Rules config
    api.getRulesConfig()
      .then(res => { if (res) setRulesConfig(res); })
      .catch(e => console.error('config:', e));

    fetchPersons();
    fetchEvents(null);
    fetchAlerts();
  }, [fetchPersons, fetchEvents, fetchAlerts]);

  useEffect(() => {
    fetchAll();
    // Poll dashboard every 30 s while the page is open
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Re-fetch events whenever filter tab changes
  useEffect(() => {
    fetchEvents(eventTypeFilter);
  }, [eventTypeFilter, fetchEvents]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleDeletePerson = async (id, name) => {
    if (!window.confirm(`Remove ${name} and purge their biometric embedding?`)) return;
    try {
      await api.deletePerson(id);
      fetchPersons();
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const handleUpdateThreshold = async (minutes) => {
    setUpdatingConfig(true);
    try {
      const res = await api.updateRulesConfig({ unattended_minutes: minutes });
      setRulesConfig(prev => ({ ...prev, unattended_minutes_threshold: res.unattended_minutes_threshold }));
    } catch (err) {
      alert('Config update failed: ' + err.message);
    } finally {
      setUpdatingConfig(false);
    }
  };

  const openSnapshot = (snapshot, event) => {
    if (snapshot) setSnapshotModal({ open: true, snapshot, event });
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* ── Hero Banner ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-navy-900 rounded-3xl p-8 text-white shadow-xl mb-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-saffron-500/10 to-transparent pointer-events-none" />
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-saffron-500/20 text-orange-300 text-xs font-semibold mb-4 border border-saffron-500/30">
            <span className="w-2 h-2 rounded-full bg-saffron-400 animate-pulse" />
            <span>CareGuard Bharat • Stage 6 — Full Dashboard Active</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Namaste, {user?.full_name}
          </h1>
          <p className="mt-2 text-slate-300 text-sm leading-relaxed">
            Centralized safety console. All detections are logged in real-time. Zero raw video or audio stored.
            Role: <strong className="text-orange-400 capitalize">{user?.role}</strong>
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/monitor"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-saffron-600 hover:bg-saffron-700 text-white text-sm font-semibold shadow-md shadow-orange-600/30 transition-all"
            >
              <Video className="w-4 h-4" />
              <span>Launch Room Monitor</span>
            </Link>
            <button
              onClick={() => setIsEnrollModalOpen(true)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold border border-white/20 backdrop-blur-sm transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Enroll Member Face</span>
            </button>
            <button
              onClick={fetchAll}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold border border-white/20 backdrop-blur-sm transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats Summary Row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<BarChart3 className="w-4 h-4" />}
          label="Total Events"
          value={stats?.total_events ?? '—'}
          sub={`${stats?.severity_counts?.critical ?? 0} critical · ${stats?.severity_counts?.high ?? 0} high`}
          color="orange"
        />
        <StatCard
          icon={<Camera className="w-4 h-4" />}
          label="Blurred Snapshots"
          value={stats?.total_snapshots ?? '—'}
          sub="7-day auto-purge"
          color="blue"
        />
        <StatCard
          icon={<HeartHandshake className="w-4 h-4" />}
          label="Active Caregivers"
          value={stats?.active_caregivers_count ?? '—'}
          sub="In last 24 hours"
          color="purple"
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Presence Logged"
          value={stats ? `${stats.caregiver_presence_minutes} min` : '—'}
          sub="Across all rooms"
          color="green"
        />
      </div>

      {/* ── Adapter Status Row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { key: 'face_service',    label: 'Face Service',    icon: <Cpu className="w-4 h-4" />,      fallback: 'LocalFaceService',    sub: 'YuNet + SFace (ONNX)',    color: 'bg-orange-50 text-saffron-600' },
          { key: 'snapshot_storage', label: 'Storage',         icon: <HardDrive className="w-4 h-4" />, fallback: 'LocalStorage',        sub: 'Blurred JPEG only',       color: 'bg-sky-50 text-sky-600' },
          { key: 'alert_service',   label: 'Alert Service',   icon: <Bell className="w-4 h-4" />,      fallback: 'LocalAlertService',   sub: 'Ring buffer + SMTP',      color: 'bg-purple-50 text-purple-600' },
          { key: 'event_store',     label: 'Event Store',     icon: <Database className="w-4 h-4" />,  fallback: 'SQLiteEventStore',    sub: 'DynamoDB-ready adapter',  color: 'bg-emerald-50 text-emerald-600' },
        ].map(a => (
          <div key={a.key} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{a.label}</span>
              <div className={`p-1.5 rounded-lg ${a.color}`}>{a.icon}</div>
            </div>
            <div className="text-sm font-bold text-slate-900 truncate">
              {healthData?.active_adapters?.[a.key] || a.fallback}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 flex items-center space-x-1">
              <CheckCircle className="w-3 h-3 text-emerald-500" />
              <span>{a.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main 2-col: Events + Alert History ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

        {/* Events timeline (2/3 width) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-slate-100 gap-3">
            <div className="flex items-center space-x-2">
              <History className="w-5 h-5 text-saffron-600" />
              <h2 className="text-base font-bold text-slate-900">Safety Event Timeline</h2>
            </div>
            <span className="text-xs text-slate-500">SQLite · 7-day retention</span>
          </div>

          {/* Filter tabs */}
          <div className="flex flex-wrap gap-1.5 px-5 py-3 bg-slate-50 border-b border-slate-100">
            <Filter className="w-3.5 h-3.5 text-slate-400 self-center mr-1" />
            {EVENT_TYPES.map(et => (
              <button
                key={et.label}
                onClick={() => setEventTypeFilter(et.value)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
                  eventTypeFilter === et.value
                    ? 'bg-saffron-600 text-white border-saffron-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {et.label}
              </button>
            ))}
          </div>

          {/* Events list */}
          <div className="p-5">
            {loadingEvents ? (
              <div className="text-center py-8 text-xs text-slate-400 animate-pulse">Loading events…</div>
            ) : events.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
                No safety anomalies recorded yet{eventTypeFilter ? ` for "${eventTypeFilter}"` : ''}. Events with blurred evidence will appear here in real-time.
              </div>
            ) : (
              <div className="space-y-2.5">
                {events.map(ev => (
                  <div
                    key={ev.id}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/40 hover:bg-white hover:shadow-sm transition-all flex items-center justify-between gap-3"
                  >
                    <div className="flex items-start space-x-3 min-w-0">
                      <div className="mt-0.5 shrink-0">{getEventTypeIcon(ev.event_type)}</div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="truncate">{ev.event_type}</span>
                          <span className="text-slate-400 font-normal">· {ev.room_device}</span>
                          <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${getSeverityBadgeClass(ev.severity)}`}>
                            {ev.severity}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(ev.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {ev.snapshot_path && (
                      <button
                        onClick={() => openSnapshot(ev.snapshot_path, ev)}
                        title="View blurred evidence"
                        className="group shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-slate-300 shadow-xs hover:border-saffron-400 hover:shadow-md transition-all"
                      >
                        <img
                          src={`/snapshots/${ev.snapshot_path}`}
                          alt="Blurred Snapshot"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Alert History Panel (1/3 width) */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Bell className="w-5 h-5 text-saffron-600" />
              <h2 className="text-base font-bold text-slate-900">Alert History</h2>
            </div>
            <button
              onClick={fetchAlerts}
              className="p-1.5 rounded-lg text-slate-400 hover:text-saffron-600 hover:bg-orange-50 transition-colors"
              title="Refresh alerts"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-96 p-4">
            {loadingAlerts ? (
              <div className="text-center py-6 text-xs text-slate-400 animate-pulse">Loading alerts…</div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                No alerts dispatched yet. Alerts appear here when safety events are detected.
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert, idx) => (
                  <div
                    key={alert.id || idx}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${getSeverityBadgeClass(alert.severity)}`}>
                        {alert.severity}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : ''}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 leading-tight">{alert.message}</p>
                    {alert.room_device && (
                      <p className="text-[10px] text-slate-500 font-medium">📍 {alert.room_device}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick test alert button */}
          <div className="p-4 border-t border-slate-100">
            <button
              onClick={async () => {
                try {
                  await api.sendTestAlert({ room_device: 'Dashboard Test', severity: 'medium' });
                  setTimeout(fetchAlerts, 500);
                } catch (e) {
                  alert('Test alert failed: ' + e.message);
                }
              }}
              className="w-full py-2 rounded-xl bg-slate-100 hover:bg-orange-50 text-xs font-bold text-slate-600 hover:text-saffron-700 border border-slate-200 hover:border-orange-300 transition-all"
            >
              🔔 Send Test Alert
            </button>
          </div>
        </div>
      </div>

      {/* ── Presence Tracking + Rules Config ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Caregiver Presence */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-saffron-600" />
              <h2 className="text-base font-bold text-slate-900">Caregiver Presence Tracking (24 h)</h2>
            </div>
            <span className="text-xs text-slate-500">Auto-logged per room</span>
          </div>
          {presenceData.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              No caregiver presence logged yet. Presence duration updates when a recognized caregiver is detected in a monitored room.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {presenceData.map((cg, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-orange-50/60 border border-orange-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">{cg.caregiver_name}</span>
                    <span className="text-xs font-extrabold text-saffron-700 bg-orange-100 px-2.5 py-0.5 rounded-full">
                      {cg.total_minutes} min
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 flex items-center justify-between">
                    <span>Rooms:</span>
                    <span className="font-semibold text-slate-800">{cg.rooms.join(', ')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rules Config */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-saffron-600" />
              <h3 className="text-sm font-bold text-slate-900">Unattended Threshold</h3>
            </div>
            <span className="text-xs font-bold text-saffron-600">
              {rulesConfig.unattended_minutes_threshold} min
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Flags <strong>DEPENDENT_UNATTENDED</strong> when a dependent is seen with no caregiver for longer than this limit.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[5, 10, 15].map(m => (
              <button
                key={m}
                disabled={updatingConfig}
                onClick={() => handleUpdateThreshold(m)}
                className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                  rulesConfig.unattended_minutes_threshold === m
                    ? 'bg-saffron-600 text-white border-saffron-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {m} min
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Enrolled Members + Shift Manager ────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3 mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <Users className="w-5 h-5 text-saffron-600" />
              <span>Enrolled Members & Caregiver Shifts</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Faces enrolled with explicit consent. Click caregiver shift row to edit hours inline.
            </p>
          </div>
          <button
            onClick={() => setIsEnrollModalOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-saffron-600 hover:bg-saffron-700 text-white text-xs font-bold shadow-sm transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Enroll New Person</span>
          </button>
        </div>

        {loadingPersons ? (
          <div className="text-center py-8 text-xs text-slate-400 animate-pulse">Loading members…</div>
        ) : enrolledPersons.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
            <Users className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-sm font-semibold text-slate-700">No members enrolled yet</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Enroll dependents (e.g. "Dadi") and caregivers (e.g. "Ayah") so the monitor can recognise them and flag unknown visitors.
            </p>
            <button
              onClick={() => setIsEnrollModalOpen(true)}
              className="mt-2 px-3.5 py-1.5 rounded-xl bg-saffron-600 text-white text-xs font-semibold shadow-sm"
            >
              Enroll First Member
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrolledPersons.map(person => (
              <div
                key={person.id}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-xs">
                      {getRoleIcon(person.role_type)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{person.name}</h4>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getRoleBadgeClass(person.role_type)}`}>
                        {person.role_type}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeletePerson(person.id, person.name)}
                    title="Delete person"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Inline shift editor for caregivers */}
                {person.role_type === 'caregiver' && (
                  <ShiftEditor person={person} onSaved={fetchPersons} />
                )}

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                  <span className="flex items-center space-x-1 text-emerald-600 font-semibold">
                    <CheckCircle className="w-3 h-3" />
                    <span>Consent Logged</span>
                  </span>
                  <span>128-d Vector Stored</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Privacy Guarantees ───────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm mb-8">
        <div className="flex items-center space-x-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-saffron-600" />
          <h2 className="text-base font-bold text-slate-900">Privacy-by-Design Standards Enforced</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: <EyeOff className="w-5 h-5 text-emerald-600 mt-0.5" />, title: 'Zero Raw Video/Audio', desc: 'Frames captured on motion only. Processed for anomalies and discarded immediately. Audio never leaves the browser.' },
            { icon: <Clock className="w-5 h-5 text-emerald-600 mt-0.5" />, title: '7-Day Retention Limit', desc: 'Stored snapshot files are automatically purged after 7 days by the APScheduler background job.' },
            { icon: <Layers className="w-5 h-5 text-emerald-600 mt-0.5" />, title: 'Client-Side Audio AI', desc: 'TensorFlow.js YAMNet runs strictly inside your local browser. Only a "distress event" label is ever transmitted.' },
          ].map(g => (
            <div key={g.title} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start space-x-3">
              {g.icon}
              <div>
                <div className="text-sm font-semibold text-slate-900">{g.title}</div>
                <p className="text-xs text-slate-500 mt-1">{g.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Implementation Roadmap ───────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center space-x-2">
          <Activity className="w-5 h-5 text-saffron-600" />
          <span>Implementation Roadmap</span>
        </h2>
        <div className="space-y-2.5">
          {[
            { n: 1, done: true,  label: 'Stage 1: System Scaffolding & Adapters',          desc: 'FastAPI, SQLite models, JWT Auth, adapter interfaces, React frontend.' },
            { n: 2, done: true,  label: 'Stage 2: Browser Camera & Motion Detection',       desc: 'Camera access, consent screen, motion detection, frame resize & upload.' },
            { n: 3, done: true,  label: 'Stage 3: Face Enrollment & Recognition',           desc: 'YuNet + SFace ONNX, explicit consent enrollment, unknown face alerts, blurred snapshots.' },
            { n: 4, done: true,  label: 'Stage 4: Rules Engine',                            desc: 'Stateful room tracking, unattended threshold, presence duration logs.' },
            { n: 5, done: true,  label: 'Stage 5: Audio Distress AI & APScheduler',         desc: 'Browser TF.js YAMNet, caregiver-absent cron, 7-day auto snapshot cleanup.' },
            { n: 6, done: true,  label: 'Stage 6: Full Dashboard',                          desc: 'Stats widgets, event filter tabs, alert history panel, inline shift manager, snapshot modal.' },
            { n: 7, done: false, label: 'Stage 7: Demo Data, Evaluation & Final Polish',    desc: 'seed_demo_data.py, evaluate.py metrics, README architecture diagram, end-to-end checklist.' },
          ].map(s => (
            <div
              key={s.n}
              className={`flex items-center justify-between p-3 rounded-xl border ${
                s.done ? 'bg-emerald-50/70 border-emerald-200' : 'bg-slate-50 border-slate-200 opacity-80'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                  s.done ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'
                }`}>
                  {s.n}
                </span>
                <div>
                  <span className="text-sm font-bold text-slate-900">{s.label}</span>
                  <span className="block text-xs text-slate-600">{s.desc}</span>
                </div>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                s.done ? 'bg-emerald-100 text-emerald-800' : 'text-slate-400'
              }`}>
                {s.done ? 'Completed' : 'Next'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      <EnrollmentModal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        onEnrolled={fetchAll}
      />

      <SnapshotModal
        isOpen={snapshotModal.open}
        snapshot={snapshotModal.snapshot}
        event={snapshotModal.event}
        onClose={() => setSnapshotModal({ open: false, snapshot: null, event: null })}
      />
    </div>
  );
}
