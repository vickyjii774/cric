import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Power, Users, Radio, Monitor, Trophy, Clipboard, ShieldCheck } from 'lucide-react';

interface MatchSummary {
  id: string;
  teamAName: string;
  teamBName: string;
  format: string;
  overs: number;
  status: 'upcoming' | 'live' | 'completed';
  currentInnings: number;
  innings: any[];
}

export default function Dashboard() {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [format, setFormat] = useState('T20');
  const [overs, setOvers] = useState(20);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null;

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const response = await fetch('/api/matches');
      const data = await response.json();
      setMatches(data);
    } catch (error) {
      console.error('Failed to fetch matches:', error);
    }
  };

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/matches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ format, overs })
      });

      if (response.status === 401 || response.status === 403) {
        navigate('/login');
        return;
      }

      const newMatch = await response.json();
      setShowCreateModal(false);
      fetchMatches();
      // Navigate straight to scorer panel
      navigate(`/scorer/${newMatch.id}`);
    } catch (error) {
      console.error('Failed to create match:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-brand-bg relative overflow-x-hidden pb-16">
      {/* Glow Effects */}
      <div className="absolute top-[-200px] right-[-200px] w-[600px] h-[600px] rounded-full bg-brand-accent/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-100px] left-[-200px] w-[500px] h-[500px] rounded-full bg-brand-success/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Trophy className="w-8 h-8 text-brand-accent animate-bounce" />
            <h1 className="text-2xl font-black text-white tracking-wider">
              CricketScorer <span className="text-brand-accent">Pro</span>
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-sm font-semibold text-white">{user.name}</span>
                  <span className="text-xs text-brand-accent uppercase tracking-wider font-bold flex items-center justify-end">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                    {user.role.replace('_', ' ')}
                  </span>
                </div>
                {user.role !== 'viewer' && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center space-x-1.5 px-4 py-2 bg-brand-accent hover:bg-brand-accent/90 text-slate-950 font-bold rounded-lg text-sm transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Match</span>
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-gray-400 hover:text-white rounded-lg transition-all"
                  title="Sign Out"
                >
                  <Power className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 text-white rounded-lg text-sm font-bold transition-all"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="glass p-8 rounded-2xl mb-12 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-brand-accent/5 rounded-full blur-[80px]" />
          <div className="z-10">
            <h2 className="text-3xl font-extrabold text-white">Broadcast-Grade Cricket Scoring</h2>
            <p className="text-gray-400 mt-2 max-w-2xl text-sm leading-relaxed">
              Create leagues, configure custom overs matches, capture ball-by-ball actions, and overlay real-time scoreboards straight into OBS Studio, vMix, or Streamlabs overlays.
            </p>
          </div>
          <div className="flex space-x-3 z-10 shrink-0">
            <a
              href="https://obsproject.com/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs text-gray-300 rounded-lg font-semibold transition-all"
            >
              <Monitor className="w-4 h-4 text-brand-accent" />
              <span>OBS Setup</span>
            </a>
          </div>
        </div>

        {/* Live Matches List */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center space-x-2">
              <Radio className="w-5 h-5 text-brand-danger animate-pulse" />
              <span>Match Dashboard</span>
            </h3>
            <button
              onClick={fetchMatches}
              className="text-xs text-brand-accent hover:underline"
            >
              Refresh matches
            </button>
          </div>

          {matches.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/30 border border-slate-800 rounded-2xl">
              <Clipboard className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No matches created yet.</p>
              {user && user.role !== 'viewer' && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 text-xs font-semibold bg-brand-accent/10 border border-brand-accent/30 text-brand-accent px-4 py-2 rounded-lg hover:bg-brand-accent/20 transition-all"
                >
                  Create one now
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {matches.map((match) => {
                const currentInnings = match.innings[match.currentInnings];
                const runs = currentInnings?.runs ?? 0;
                const wickets = currentInnings?.wickets ?? 0;
                const oversBowled = currentInnings?.overs ?? '0.0';

                return (
                  <div key={match.id} className="glass hover:glass-glow rounded-xl p-5 flex flex-col justify-between transition-all duration-300 relative group">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full ${
                        match.status === 'live' ? 'bg-brand-danger/20 text-brand-danger border border-brand-danger/30' :
                        match.status === 'completed' ? 'bg-brand-success/20 text-brand-success border border-brand-success/30' :
                        'bg-brand-warning/20 text-brand-warning border border-brand-warning/30'
                      }`}>
                        {match.status}
                      </span>
                      <span className="text-xs text-gray-500 font-medium uppercase">{match.format} • {match.overs} Overs</span>
                    </div>

                    {/* Team Names */}
                    <div className="space-y-3 mb-6">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-white text-base truncate">{match.teamAName}</span>
                        {match.status === 'live' && match.currentInnings === 0 && (
                          <span className="text-sm font-bold text-gray-400">Batting</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-white text-base truncate">{match.teamBName}</span>
                        {match.status === 'live' && match.currentInnings === 1 && (
                          <span className="text-sm font-bold text-gray-400">Batting</span>
                        )}
                      </div>
                    </div>

                    {/* Scoring Quick Info */}
                    {match.status !== 'upcoming' && currentInnings && (
                      <div className="bg-slate-900/50 rounded-lg p-3 mb-5 flex items-center justify-between text-sm">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Score</span>
                          <span className="text-white font-extrabold text-lg">{runs}/{wickets}</span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Overs</span>
                          <span className="text-white font-semibold">{oversBowled}</span>
                        </div>
                      </div>
                    )}

                    {/* Action Hubs */}
                    <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-800/80">
                      <Link
                        to={`/live/${match.id}`}
                        className="flex-1 min-w-[70px] flex items-center justify-center space-x-1 py-2 bg-slate-800 hover:bg-slate-700/80 text-gray-200 hover:text-white rounded-lg text-xs font-bold transition-all"
                      >
                        <Radio className="w-3.5 h-3.5 text-brand-danger" />
                        <span>Viewer</span>
                      </Link>

                      <Link
                        to={`/overlay/${match.id}`}
                        className="flex-1 min-w-[70px] flex items-center justify-center space-x-1 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-gray-300 hover:text-white rounded-lg text-xs font-semibold transition-all"
                      >
                        <Monitor className="w-3.5 h-3.5 text-brand-accent" />
                        <span>Overlay</span>
                      </Link>

                      {user && user.role !== 'viewer' && (
                        <Link
                          to={`/scorer/${match.id}`}
                          className="flex-1 min-w-[70px] flex items-center justify-center space-x-1 py-2 bg-brand-accent/10 border border-brand-accent/30 hover:bg-brand-accent text-brand-accent hover:text-slate-950 rounded-lg text-xs font-bold transition-all"
                        >
                          <Clipboard className="w-3.5 h-3.5" />
                          <span>Score</span>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Create Match Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md glass p-6 rounded-2xl relative">
            <h4 className="text-xl font-bold text-white mb-4">Create New Match</h4>
            <form onSubmit={handleCreateMatch} className="space-y-4">
              <div>
                <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Match Format</label>
                <select
                  value={format}
                  onChange={(e) => {
                    setFormat(e.target.value);
                    if (e.target.value === 'T10') setOvers(10);
                    else if (e.target.value === 'T20') setOvers(20);
                    else if (e.target.value === 'T30') setOvers(30);
                    else if (e.target.value === 'T50' || e.target.value === 'ODI') setOvers(50);
                    else if (e.target.value === 'Test') setOvers(90);
                  }}
                  className="w-full bg-slate-900 border border-slate-700/60 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
                >
                  <option value="T10">T10</option>
                  <option value="T20">T20 (T20 International/League)</option>
                  <option value="T30">T30</option>
                  <option value="T50">T50</option>
                  <option value="ODI">ODI (One Day International)</option>
                  <option value="Test">Test Match</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Overs per Innings</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={99}
                  value={overs}
                  onChange={(e) => setOvers(parseInt(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700/60 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-slate-850 border border-slate-700 hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-brand-accent hover:bg-brand-accent/90 text-slate-950 font-bold py-2.5 rounded-lg text-sm transition-all"
                >
                  {loading ? 'Creating...' : 'Initialize'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
