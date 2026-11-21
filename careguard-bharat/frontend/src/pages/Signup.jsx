import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, Mail, User, CheckCircle2, AlertCircle, HeartHandshake, Home } from 'lucide-react';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('family');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!consentAccepted) {
      setError('Please acknowledge the privacy & consent disclosure before continuing.');
      return;
    }

    setLoading(true);
    try {
      await signup({
        full_name: fullName,
        email,
        password,
        role
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-orange-100 text-saffron-600 flex items-center justify-center mb-3">
              <Shield className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create CareGuard Account</h1>
            <p className="text-sm text-slate-500 mt-1">Smart, respectful care safety for your family</p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-800 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Selection */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                Select Your Role
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('family')}
                  className={`p-3.5 rounded-xl border text-left transition-all flex items-start space-x-3 ${
                    role === 'family'
                      ? 'border-saffron-500 bg-orange-50/60 ring-2 ring-saffron-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Home className={`w-5 h-5 mt-0.5 ${role === 'family' ? 'text-saffron-600' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-sm font-bold text-slate-900">Family Admin</div>
                    <div className="text-xs text-slate-500">Monitor rooms & view alerts</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('caregiver')}
                  className={`p-3.5 rounded-xl border text-left transition-all flex items-start space-x-3 ${
                    role === 'caregiver'
                      ? 'border-saffron-500 bg-orange-50/60 ring-2 ring-saffron-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <HeartHandshake className={`w-5 h-5 mt-0.5 ${role === 'caregiver' ? 'text-saffron-600' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-sm font-bold text-slate-900">Caregiver</div>
                    <div className="text-xs text-slate-500">Log shifts & room check-ins</div>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ramesh Sharma"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-saffron-500 text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-saffron-500 text-sm transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-saffron-500 text-sm transition-all"
                />
              </div>
            </div>

            {/* Privacy By Design Disclosure */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
              <div className="font-semibold text-slate-900 flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Privacy By Design Guarantee</span>
              </div>
              <p>
                CareGuard Bharat strictly enforces that <strong>no continuous raw video or raw audio is ever stored</strong>. All stored event snapshots are automatically face-blurred, and audio distress classification runs strictly on the client device.
              </p>
              <label className="flex items-start space-x-2.5 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-saffron-600 focus:ring-saffron-500"
                />
                <span className="text-slate-800 font-medium">
                  I understand and accept the privacy protocols and consent terms.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-saffron-600 hover:bg-saffron-700 focus:ring-4 focus:ring-saffron-500/20 shadow-md shadow-orange-600/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{loading ? 'Creating Account...' : 'Complete Registration'}</span>
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            Already registered?{' '}
            <Link to="/login" className="font-semibold text-saffron-600 hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
