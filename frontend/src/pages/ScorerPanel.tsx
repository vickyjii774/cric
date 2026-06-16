import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Wifi, WifiOff, RotateCcw, Plus, UserPlus, AlertCircle, CheckCircle } from 'lucide-react';

interface BatterScore {
  playerId: string;
  playerName: string;
  runs: number;
  balls: number;
  boundaries4: number;
  boundaries6: number;
  strikeRate: number;
  outDetails?: string;
  isStriker: boolean;
  isNonStriker: boolean;
}

interface BowlerScore {
  playerId: string;
  playerName: string;
  overs: number;
  ballsBowled: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
  economy: number;
}

interface MatchState {
  id: string;
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
  format: string;
  overs: number;
  status: 'upcoming' | 'live' | 'completed';
  toss?: {
    wonBy: string;
    decision: 'bat' | 'bowl';
  };
  currentInnings: number;
  innings: Array<{
    battingTeamId: string;
    bowlingTeamId: string;
    runs: number;
    wickets: number;
    overs: number;
    ballsBowled: number;
    target?: number;
    isComplete: boolean;
    scorecard: {
      batters: BatterScore[];
      bowlers: BowlerScore[];
      extras: { wides: number; noBalls: number; byes: number; legByes: number; penalty: number };
    };
  }>;
  balls: any[];
}

export default function ScorerPanel() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [match, setMatch] = useState<MatchState | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Setup/Toss selections
  const [tossWonBy, setTossWonBy] = useState('');
  const [tossDecision, setTossDecision] = useState<'bat' | 'bowl'>('bat');

  // Player selector state
  const [strikerId, setStrikerId] = useState('');
  const [nonStrikerId, setNonStrikerId] = useState('');
  const [bowlerId, setBowlerId] = useState('');

  // Extras configuration state
  const [selectedExtraType, setSelectedExtraType] = useState<'wide' | 'noBall' | 'bye' | 'legBye' | 'penalty' | null>(null);
  const [extraRuns, setExtraRuns] = useState(0);

  // Wicket configurations state
  const [showWicketModal, setShowWicketModal] = useState(false);
  const [wicketType, setWicketType] = useState<'bowled' | 'caught' | 'lbw' | 'stumped' | 'runout' | 'caught_bowled' | 'hit_wicket' | 'mankad' | 'retired_hurt' | 'retired_out'>('bowled');
  const [dismissedBatsmanId, setDismissedBatsmanId] = useState('');
  const [fielderId, setFielderId] = useState('');
  const [wicketDescription, setWicketDescription] = useState('');

  // Commentary input
  const [commentary, setCommentary] = useState('');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchMatch();

    const handleOnline = () => {
      setOnline(true);
      processSyncQueue();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [id]);

  const fetchMatch = async () => {
    try {
      const response = await fetch(`/api/matches/${id}`);
      if (!response.ok) throw new Error('Failed to load match');
      const data = await response.json();
      setMatch(data);

      // Set default values for toss picker
      setTossWonBy(data.teamAId);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSetToss = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/matches/${id}/toss`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ wonBy: tossWonBy, decision: tossDecision })
      });
      const data = await response.json();
      setMatch(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartInnings = async () => {
    if (!strikerId || !nonStrikerId || !bowlerId) {
      alert('Please select striker, non-striker and bowler');
      return;
    }
    if (strikerId === nonStrikerId) {
      alert('Striker and non-striker must be different players');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/matches/${id}/players`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ strikerId, nonStrikerId, bowlerId })
      });
      const data = await response.json();
      setMatch(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const processSyncQueue = async () => {
    if (syncQueue.length === 0) return;
    console.log('Online! Syncing local offline scoring events...');
    const queue = [...syncQueue];
    setSyncQueue([]);

    for (const item of queue) {
      try {
        await fetch(`/api/matches/${id}/ball`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(item)
        });
      } catch (err) {
        console.error('Failed to sync offline item, putting back in queue', err);
        setSyncQueue((prev) => [...prev, item]);
        break;
      }
    }
    fetchMatch();
  };

  // Main Scoring handler
  const handleScoreBall = async (runs: number) => {
    if (!match) return;

    const payload = {
      runs: selectedExtraType === 'wide' || selectedExtraType === 'noBall' ? 0 : runs,
      extrasType: selectedExtraType || undefined,
      extraRuns: selectedExtraType ? (selectedExtraType === 'wide' || selectedExtraType === 'noBall' ? runs : extraRuns) : 0,
      commentary: commentary.trim() || undefined
    };

    // Reset extra selections
    setSelectedExtraType(null);
    setExtraRuns(0);
    setCommentary('');

    if (!online) {
      // Offline mode: queue event and update mock UI locally for scorer responsiveness
      setSyncQueue((prev) => [...prev, payload]);
      alert('Offline mode: Saved ball locally. Will sync when connection is restored.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/matches/${id}/ball`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      setMatch(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleWicket = async () => {
    if (!dismissedBatsmanId) {
      alert('Please select dismissed batsman');
      return;
    }

    const payload = {
      runs: 0,
      extraRuns: 0,
      wicket: {
        batsmanId: dismissedBatsmanId,
        type: wicketType,
        fielderId: fielderId || undefined,
        description: wicketDescription || `${wicketType.replace('_', ' ').toUpperCase()} dismissal`
      },
      commentary: commentary.trim() || undefined
    };

    setShowWicketModal(false);
    setDismissedBatsmanId('');
    setFielderId('');
    setWicketDescription('');
    setCommentary('');

    if (!online) {
      setSyncQueue((prev) => [...prev, payload]);
      alert('Offline mode: Saved wicket locally.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/matches/${id}/ball`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      setMatch(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async () => {
    if (!confirm('Are you sure you want to undo the last ball?')) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/matches/${id}/undo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setMatch(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!match) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <span className="text-gray-400 text-sm animate-pulse">Loading scorer console...</span>
      </div>
    );
  }

  // Determine current team names
  const battingTeamName = match.innings[match.currentInnings]?.battingTeamId === match.teamAId ? match.teamAName : match.teamBName;
  const bowlingTeamName = match.innings[match.currentInnings]?.battingTeamId === match.teamAId ? match.teamBName : match.teamAName;

  const currentInnings = match.innings[match.currentInnings];
  const striker = currentInnings?.scorecard.batters.find((b) => b.isStriker);
  const nonStriker = currentInnings?.scorecard.batters.find((b) => b.isNonStriker);
  const bowler = currentInnings?.scorecard.bowlers[currentInnings?.scorecard.bowlers.length - 1];

  // Helper arrays for player selector (11 players per team)
  const battingSquad = currentInnings?.battingTeamId === match.teamAId 
    ? Array.from({ length: 11 }, (_, i) => ({ id: `ply_a_${i + 1}`, name: `A. Batter ${i + 1}` }))
    : Array.from({ length: 11 }, (_, i) => ({ id: `ply_b_${i + 1}`, name: `B. Bowler ${i + 1}` }));

  const bowlingSquad = currentInnings?.bowlingTeamId === match.teamAId
    ? Array.from({ length: 11 }, (_, i) => ({ id: `ply_a_${i + 1}`, name: `A. Batter ${i + 1}` }))
    : Array.from({ length: 11 }, (_, i) => ({ id: `ply_b_${i + 1}`, name: `B. Bowler ${i + 1}` }));

  return (
    <div className="min-h-screen bg-brand-bg text-gray-100 flex flex-col justify-between pb-8">
      {/* Top Navbar */}
      <div className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link to="/" className="p-2 hover:bg-slate-800 rounded-lg text-gray-400 hover:text-white transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="font-bold text-white text-base leading-tight">Scorer Panel</h2>
            <p className="text-[10px] text-gray-400 font-semibold tracking-wide uppercase">{match.teamAName} vs {match.teamBName}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {online ? (
            <span className="flex items-center text-xs text-brand-success bg-brand-success/10 px-2.5 py-1 rounded-full border border-brand-success/30 font-semibold">
              <Wifi className="w-3.5 h-3.5 mr-1" />
              Live
            </span>
          ) : (
            <span className="flex items-center text-xs text-brand-warning bg-brand-warning/10 px-2.5 py-1 rounded-full border border-brand-warning/30 font-semibold animate-pulse">
              <WifiOff className="w-3.5 h-3.5 mr-1" />
              Offline ({syncQueue.length} queued)
            </span>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-4xl w-full mx-auto px-4 mt-6 flex-grow flex flex-col justify-center">
        {/* Phase 1: Toss Selector */}
        {match.status === 'upcoming' && !match.toss && (
          <div className="glass p-8 rounded-2xl space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-white">Toss Configuration</h3>
              <p className="text-xs text-gray-400 mt-1">Select who won the toss and their match decision</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Toss Winner</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setTossWonBy(match.teamAId)}
                    className={`p-4 rounded-xl border font-bold text-sm transition-all ${
                      tossWonBy === match.teamAId ? 'bg-brand-accent text-slate-950 border-brand-accent' : 'bg-slate-900 border-slate-700/60 text-white'
                    }`}
                  >
                    {match.teamAName}
                  </button>
                  <button
                    onClick={() => setTossWonBy(match.teamBId)}
                    className={`p-4 rounded-xl border font-bold text-sm transition-all ${
                      tossWonBy === match.teamBId ? 'bg-brand-accent text-slate-950 border-brand-accent' : 'bg-slate-900 border-slate-700/60 text-white'
                    }`}
                  >
                    {match.teamBName}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Decision</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setTossDecision('bat')}
                    className={`p-4 rounded-xl border font-bold text-sm transition-all ${
                      tossDecision === 'bat' ? 'bg-brand-accent text-slate-950 border-brand-accent' : 'bg-slate-900 border-slate-700/60 text-white'
                    }`}
                  >
                    BAT FIRST
                  </button>
                  <button
                    onClick={() => setTossDecision('bowl')}
                    className={`p-4 rounded-xl border font-bold text-sm transition-all ${
                      tossDecision === 'bowl' ? 'bg-brand-accent text-slate-950 border-brand-accent' : 'bg-slate-900 border-slate-700/60 text-white'
                    }`}
                  >
                    BOWL FIRST
                  </button>
                </div>
              </div>

              <button
                onClick={handleSetToss}
                disabled={loading}
                className="w-full bg-brand-accent hover:bg-brand-accent/90 text-slate-950 font-extrabold py-3.5 rounded-xl text-sm transition-all"
              >
                Set Toss & Start Match
              </button>
            </div>
          </div>
        )}

        {/* Phase 2: Active Players Selector */}
        {match.status === 'live' && currentInnings && (!striker || !nonStriker || !bowler) && (
          <div className="glass p-6 rounded-2xl space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-bold text-white">Select Active Batter & Bowler</h3>
              <p className="text-xs text-gray-400 mt-1">Setup the opening partnership and first bowler to start the innings</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{battingTeamName} Batsman (Striker)</label>
                  <select
                    value={strikerId}
                    onChange={(e) => setStrikerId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/60 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
                  >
                    <option value="">Choose Striker...</option>
                    {battingSquad.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{battingTeamName} Batsman (Non-Striker)</label>
                  <select
                    value={nonStrikerId}
                    onChange={(e) => setNonStrikerId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/60 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
                  >
                    <option value="">Choose Non-Striker...</option>
                    {battingSquad.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{bowlingTeamName} Bowler</label>
                <select
                  value={bowlerId}
                  onChange={(e) => setBowlerId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/60 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
                >
                  <option value="">Choose Bowler...</option>
                  {bowlingSquad.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleStartInnings}
                disabled={loading}
                className="w-full bg-brand-accent hover:bg-brand-accent/90 text-slate-950 font-extrabold py-3 rounded-lg text-sm transition-all"
              >
                Confirm playing lineup
              </button>
            </div>
          </div>
        )}

        {/* Phase 3: Live Scoring Console */}
        {match.status === 'live' && currentInnings && striker && nonStriker && bowler && (
          <div className="space-y-6">
            {/* Live Mini Scorecard */}
            <div className="glass p-5 rounded-2xl grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Innings Score</span>
                <h4 className="text-2xl font-black text-white">{currentInnings.runs}/{currentInnings.wickets}</h4>
                <p className="text-xs text-gray-400 mt-0.5">Overs: {currentInnings.overs} ({match.format})</p>
              </div>

              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Batting Team</span>
                <p className="text-sm font-semibold text-white truncate">{battingTeamName}</p>
                {currentInnings.target && (
                  <p className="text-xs text-brand-accent font-medium mt-0.5">Target: {currentInnings.target}</p>
                )}
              </div>

              {/* Striker & Non-Striker details */}
              <div className="col-span-2 space-y-2 border-l border-slate-800/80 pl-4">
                <div className="flex justify-between items-center text-xs">
                  <span className={`font-bold ${striker.isStriker ? 'text-brand-accent text-glow' : 'text-gray-400'}`}>
                    🏏 {striker.playerName} *
                  </span>
                  <span className="font-semibold text-white">{striker.runs} ({striker.balls})</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400 font-medium">{nonStriker.playerName}</span>
                  <span className="font-semibold text-white">{nonStriker.runs} ({nonStriker.balls})</span>
                </div>
                <div className="text-[10px] text-gray-400 pt-1 border-t border-slate-800/60 flex justify-between">
                  <span>Bowler: <strong className="text-white font-bold">{bowler.playerName}</strong></span>
                  <span>{bowler.wickets}-{bowler.runsConceded} ({bowler.overs})</span>
                </div>
              </div>
            </div>

            {/* Ball-by-ball actions keypad */}
            <div className="glass p-6 rounded-2xl space-y-6">
              {/* Extra Type Selectors */}
              <div>
                <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Extras Modifier</span>
                <div className="flex flex-wrap gap-2">
                  {(['wide', 'noBall', 'bye', 'legBye', 'penalty'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedExtraType(selectedExtraType === type ? null : type)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        selectedExtraType === type 
                          ? 'bg-brand-accent text-slate-950 border-brand-accent' 
                          : 'bg-slate-900 border-slate-700/60 text-gray-300 hover:text-white'
                      }`}
                    >
                      {type.replace('noBall', 'No Ball').toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Run Input Keypad */}
              <div>
                <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-3">
                  {selectedExtraType ? `Enter runs scored via ${selectedExtraType.toUpperCase()}` : 'Enter runs scored'}
                </span>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
                  {[0, 1, 2, 3, 4, 5, 6].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleScoreBall(num)}
                      className="aspect-square flex items-center justify-center bg-slate-900 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-500 rounded-full text-lg font-black text-white hover:scale-105 active:scale-95 transition-all shadow-md"
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Wickets & Undo Actions Row */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800/80">
                <button
                  onClick={() => {
                    setDismissedBatsmanId(striker.playerId);
                    setShowWicketModal(true);
                  }}
                  className="py-3 bg-brand-danger hover:bg-brand-danger/90 text-white font-bold rounded-lg text-sm transition-all"
                >
                  Wicket Dismissal
                </button>

                <button
                  onClick={handleUndo}
                  className="py-3 bg-slate-800 hover:bg-slate-750 border border-slate-700/60 text-gray-300 hover:text-white font-bold rounded-lg text-sm flex items-center justify-center space-x-2 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Undo last ball</span>
                </button>
              </div>

              {/* Over complete switcher trigger */}
              {currentInnings.overs > 0 && currentInnings.overs % 1 === 0 && (
                <div className="p-3 bg-brand-accent/10 border border-brand-accent/30 text-brand-accent rounded-lg text-xs font-semibold flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>Over Complete! Select the new bowler and batsman roles to resume.</span>
                </div>
              )}
            </div>

            {/* Commentary field */}
            <div className="glass p-4 rounded-xl">
              <label className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Manual Ball Commentary (Optional)</label>
              <input
                type="text"
                value={commentary}
                onChange={(e) => setCommentary(e.target.value)}
                placeholder="e.g. Beautiful cover drive for four runs."
                className="w-full bg-slate-900 border border-slate-700/60 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
              />
            </div>
          </div>
        )}

        {/* Phase 4: Match Completed */}
        {match.status === 'completed' && (
          <div className="glass p-8 rounded-2xl text-center space-y-4">
            <div className="inline-flex p-3 rounded-full bg-brand-success/10 text-brand-success">
              <CheckCircle className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-black text-white">Match Completed</h3>
            <p className="text-sm text-gray-400">
              The match has ended successfully. Scorecard calculations and statistics are saved.
            </p>
            <div className="flex justify-center space-x-4 pt-4">
              <Link
                to="/"
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-bold transition-all"
              >
                Back to Dashboard
              </Link>
              <Link
                to={`/live/${id}`}
                className="px-6 py-2.5 bg-brand-accent hover:bg-brand-accent/90 text-slate-950 rounded-lg text-sm font-bold transition-all"
              >
                View Scorecard
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Wicket Modal */}
      {showWicketModal && striker && nonStriker && bowler && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md glass p-6 rounded-2xl space-y-4">
            <h4 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Record Wicket Dismissal</h4>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Dismissed Batsman</label>
                <select
                  value={dismissedBatsmanId}
                  onChange={(e) => setDismissedBatsmanId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/60 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value={striker.playerId}>{striker.playerName} (Striker)</option>
                  <option value={nonStriker.playerId}>{nonStriker.playerName} (Non-Striker)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Dismissal Type</label>
                <select
                  value={wicketType}
                  onChange={(e) => setWicketType(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700/60 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="bowled">Bowled</option>
                  <option value="caught">Caught</option>
                  <option value="lbw">LBW</option>
                  <option value="stumped">Stumped</option>
                  <option value="runout">Run Out</option>
                  <option value="caught_bowled">Catch and Bowled</option>
                  <option value="hit_wicket">Hit Wicket</option>
                  <option value="mankad">Mankad Run Out</option>
                  <option value="retired_hurt">Retired Hurt</option>
                  <option value="retired_out">Retired Out</option>
                </select>
              </div>

              {['caught', 'stumped', 'runout'].includes(wicketType) && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Fielder involved</label>
                  <select
                    value={fielderId}
                    onChange={(e) => setFielderId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/60 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    <option value="">Select Fielder...</option>
                    {bowlingSquad.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Custom Description / Commentary</label>
                <input
                  type="text"
                  value={wicketDescription}
                  onChange={(e) => setWicketDescription(e.target.value)}
                  placeholder="e.g. Caught by Fielder at deep midwicket"
                  className="w-full bg-slate-900 border border-slate-700/60 text-white rounded-lg px-3 py-2 text-sm focus:outline-none"
                />
              </div>
            </div>

            <div className="flex space-x-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setShowWicketModal(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-750 text-white py-2 rounded-lg font-bold text-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleWicket}
                className="flex-1 bg-brand-danger hover:bg-brand-danger/90 text-white py-2 rounded-lg font-bold text-sm transition-all"
              >
                Confirm Dismissal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
