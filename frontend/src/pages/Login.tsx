import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Lock, Mail, ChevronRight } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const setDemoCreds = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-brand-bg px-4">
      {/* Background Neon Glows */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-brand-accent/10 blur-[150px]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-brand-success/5 blur-[150px]" />

      <div className="w-full max-w-md glass glass-glow p-8 rounded-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-full bg-brand-accent/10 text-brand-accent mb-3">
            <Target className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">CricketScorer <span className="text-brand-accent">Pro</span></h2>
          <p className="text-gray-400 text-sm mt-1">Professional Live Scoring Console</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-brand-danger/10 border border-brand-danger/30 text-brand-danger text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="scorer@cricket.com"
                className="w-full bg-slate-900/60 border border-slate-700/60 text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-accent/40 placeholder-gray-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900/60 border border-slate-700/60 text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-accent/40 placeholder-gray-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-accent hover:bg-brand-accent/90 text-slate-950 font-bold py-3 rounded-lg flex items-center justify-center transition-all duration-200"
          >
            {loading ? 'Signing In...' : 'Log In'}
            <ChevronRight className="w-5 h-5 ml-1" />
          </button>
        </form>

        {/* Demo Credentials Section */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          <p className="text-xs text-gray-400 text-center mb-3">Quick Login (Demo Accounts)</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setDemoCreds('scorer@cricket.com', 'scorer123')}
              className="px-3 py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 text-xs text-gray-300 rounded-lg transition-all"
            >
              Scorer Panel <br />
              <span className="text-brand-accent font-semibold">scorer@cricket.com</span>
            </button>
            <button
              onClick={() => setDemoCreds('admin@cricket.com', 'admin123')}
              className="px-3 py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 text-xs text-gray-300 rounded-lg transition-all"
            >
              Super Admin <br />
              <span className="text-brand-success font-semibold">admin@cricket.com</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
