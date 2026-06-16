import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { motion, AnimatePresence } from 'framer-motion';

export default function OverlayView() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'full'; // Options: full, minimal, lowerthird, summary

  const { matchData: socketMatch } = useSocket(id);
  const [match, setMatch] = useState<any>(null);

  useEffect(() => {
    fetchMatch();
    
    // Inject custom class to body to ensure background is transparent for OBS chroma-key/alpha
    document.body.classList.add('overlay-transparent');
    return () => {
      document.body.classList.remove('overlay-transparent');
    };
  }, [id]);

  useEffect(() => {
    if (socketMatch) {
      setMatch(socketMatch);
    }
  }, [socketMatch]);

  const fetchMatch = async () => {
    try {
      const response = await fetch(`/api/matches/${id}`);
      const data = await response.json();
      setMatch(data);
    } catch (error) {
      console.error(error);
    }
  };

  if (!match) {
    return (
      <div className="p-4 text-xs font-bold text-white bg-slate-950/80 rounded w-max">
        Connecting broadcast source...
      </div>
    );
  }

  const currentInnings = match.innings[match.currentInnings];
  if (!currentInnings) {
    return (
      <div className="p-4 text-xs font-bold text-white bg-slate-950/80 rounded w-max">
        Innings not started
      </div>
    );
  }

  const battingTeamName = currentInnings.battingTeamId === match.teamAId ? match.teamAName : match.teamBName;
  const bowlingTeamName = currentInnings.battingTeamId === match.teamAId ? match.teamBName : match.teamAName;

  const striker = currentInnings.scorecard.batters.find((b: any) => b.isStriker);
  const nonStriker = currentInnings.scorecard.batters.find((b: any) => b.isNonStriker);
  const bowler = currentInnings.scorecard.bowlers[currentInnings.scorecard.bowlers.length - 1];

  const recentBalls = match.balls
    .filter((b: any) => b.inningsIndex === match.currentInnings)
    .slice(-6);

  // Render 1: Minimal Score Bug (Top-left corner style)
  if (type === 'minimal') {
    return (
      <div className="p-4 font-sans select-none">
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex h-12 bg-slate-950 text-white rounded-lg overflow-hidden border border-slate-800 shadow-2xl"
        >
          {/* Team Name and Score */}
          <div className="bg-slate-900 px-4 flex items-center font-black tracking-tight text-base border-r border-slate-800">
            {battingTeamName.substring(0, 3).toUpperCase()}
            <span className="text-brand-accent ml-2">{currentInnings.runs}/{currentInnings.wickets}</span>
          </div>
          {/* Overs */}
          <div className="px-3 flex items-center font-bold text-xs bg-slate-950 border-r border-slate-800 text-gray-300">
            OVS {currentInnings.overs}
          </div>
          {/* Target */}
          {currentInnings.target && (
            <div className="px-3 flex items-center font-black text-xs bg-slate-950 text-brand-warning">
              TGT {currentInnings.target}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // Render 2: Lower Third Partnership or Player highlight
  if (type === 'lowerthird') {
    const pRuns = striker && nonStriker ? striker.runs + nonStriker.runs : 0;
    const pBalls = striker && nonStriker ? striker.balls + nonStriker.balls : 0;

    return (
      <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 w-full max-w-2xl px-4 select-none">
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-950/90 border-t-4 border-brand-accent rounded-xl shadow-2xl p-4 flex justify-between items-center text-white"
        >
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-brand-accent uppercase tracking-widest">Active Partnership</span>
            <h4 className="text-lg font-black">{battingTeamName}</h4>
          </div>

          <div className="text-right">
            <div className="text-2xl font-black text-white">{pRuns} <span className="text-xs text-gray-400 font-medium">runs</span></div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Off {pBalls} Deliveries</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Render 3: Full Screen Match Summary card
  if (type === 'summary') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 select-none">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-2xl bg-slate-950/95 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6 text-white text-center"
        >
          <div className="space-y-2">
            <span className="text-xs text-brand-accent font-extrabold uppercase tracking-widest">Match Summary</span>
            <h2 className="text-2xl font-black">{match.teamAName} vs {match.teamBName}</h2>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-850">
            {match.innings.map((inn: any, idx: number) => (
              <div key={idx} className="bg-slate-900/50 p-4 rounded-xl border border-slate-850">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Innings {idx + 1}</span>
                <h3 className="text-xl font-black text-white mt-1">{inn.runs} / {inn.wickets}</h3>
                <p className="text-xs text-gray-400 font-semibold mt-0.5">Overs: {inn.overs}</p>
              </div>
            ))}
          </div>

          {match.status === 'completed' && match.winnerId && (
            <div className="p-3 bg-brand-success/15 border border-brand-success/30 text-brand-success rounded-xl font-extrabold text-sm uppercase tracking-wider">
              Winner: {match.winnerId === 'tie' ? 'Match Tied!' : match.winnerId === match.teamAId ? match.teamAName : match.teamBName}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // Default Render: Full Scoreboard Banner (Bottom of Screen typical overlay)
  return (
    <div className="absolute bottom-6 left-0 right-0 px-8 font-sans select-none">
      <motion.div 
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full bg-slate-950/95 text-white rounded-xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-800"
      >
        {/* Main Score area */}
        <div className="bg-slate-900/90 px-6 py-4 flex flex-col justify-center shrink-0 min-w-[200px]">
          <span className="text-[10px] text-brand-accent font-black tracking-widest uppercase mb-0.5">{battingTeamName}</span>
          <div className="flex items-baseline space-x-2">
            <h3 className="text-3xl font-black text-white leading-none">{currentInnings.runs}/{currentInnings.wickets}</h3>
            <span className="text-sm font-bold text-gray-400">({currentInnings.overs})</span>
          </div>
          {currentInnings.target && (
            <span className="text-[9px] text-brand-warning font-bold uppercase tracking-wider mt-1">Target: {currentInnings.target}</span>
          )}
        </div>

        {/* Active Batters info */}
        <div className="flex-grow px-6 py-4 flex items-center justify-between">
          <div className="flex space-x-8 text-sm">
            {striker && (
              <div className="flex flex-col">
                <span className="text-brand-accent font-extrabold text-xs">
                  🏏 {striker.playerName} *
                </span>
                <span className="text-white font-bold mt-0.5">{striker.runs} <span className="text-[10px] text-gray-400 font-normal">({striker.balls})</span></span>
              </div>
            )}
            {nonStriker && (
              <div className="flex flex-col">
                <span className="text-gray-400 font-semibold text-xs">
                  {nonStriker.playerName}
                </span>
                <span className="text-white font-bold mt-0.5">{nonStriker.runs} <span className="text-[10px] text-gray-400 font-normal">({nonStriker.balls})</span></span>
              </div>
            )}
          </div>

          {/* Active Bowler */}
          {bowler && (
            <div className="text-right flex flex-col">
              <span className="text-gray-400 font-semibold text-xs">Bowler</span>
              <span className="text-white font-bold mt-0.5">
                {bowler.playerName} <span className="text-[10px] text-brand-success font-semibold">{bowler.wickets}-{bowler.runsConceded}</span>
              </span>
            </div>
          )}
        </div>

        {/* Last 6 Deliveries of current over */}
        <div className="bg-slate-900/60 px-6 py-4 flex items-center justify-center shrink-0 min-w-[200px]">
          <div className="space-y-1">
            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block text-center mb-1">This Over</span>
            <div className="flex space-x-1.5 justify-center">
              {recentBalls.length === 0 ? (
                <span className="text-[10px] text-gray-500 italic">No balls</span>
              ) : (
                recentBalls.map((b: any) => {
                  let colorClass = 'bg-slate-900 border-slate-800 text-gray-300';
                  if (b.runs === 4) colorClass = 'bg-brand-warning text-slate-950 border-brand-warning font-black';
                  if (b.runs === 6) colorClass = 'bg-brand-success text-slate-950 border-brand-success font-black';
                  if (b.wicket) colorClass = 'bg-brand-danger text-white border-brand-danger font-black';
                  
                  return (
                    <div
                      key={b.id}
                      className={`w-6 h-6 flex items-center justify-center rounded-full border text-[9px] font-bold ${colorClass}`}
                    >
                      {b.wicket ? 'W' : b.runs}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
