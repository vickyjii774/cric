import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, BarChart3, TrendingUp, HelpCircle, Download, Printer } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

export default function MatchCenter() {
  const { id } = useParams<{ id: string }>();
  const { matchData: socketMatch, isConnected } = useSocket(id);
  const [match, setMatch] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'live' | 'scorecard' | 'graphs'>('live');

  useEffect(() => {
    fetchMatch();
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

  const handlePrint = () => {
    window.print();
  };

  if (!match) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <span className="text-gray-400 animate-pulse text-sm">Loading match statistics...</span>
      </div>
    );
  }

  const currentInnings = match.innings[match.currentInnings];
  const inn1 = match.innings[0];
  const inn2 = match.innings[1];

  const battingTeamName = currentInnings?.battingTeamId === match.teamAId ? match.teamAName : match.teamBName;
  const bowlingTeamName = currentInnings?.battingTeamId === match.teamAId ? match.teamBName : match.teamAName;

  const striker = currentInnings?.scorecard.batters.find((b: any) => b.isStriker);
  const nonStriker = currentInnings?.scorecard.batters.find((b: any) => b.isNonStriker);
  const bowler = currentInnings?.scorecard.bowlers[currentInnings?.scorecard.bowlers.length - 1];

  // Last 12 balls list for display
  const recentBalls = match.balls
    .filter((b: any) => b.inningsIndex === match.currentInnings)
    .slice(-12)
    .reverse();

  // Graph Data Calculations
  // 1. Manhattan Chart (Runs per over)
  const getManhattanData = (inningsIndex: number) => {
    const oversCount = Math.ceil(match.overs);
    const data = Array(oversCount).fill(0);

    match.balls.forEach((ball: any) => {
      if (ball.inningsIndex === inningsIndex) {
        const oNum = ball.overNum;
        if (oNum < oversCount) {
          const runVal = (ball.extrasType === 'wide' || ball.extrasType === 'noBall') 
            ? (1 + ball.extraRuns) 
            : ball.runs;
          data[oNum] += runVal;
        }
      }
    });

    return {
      labels: Array.from({ length: oversCount }, (_, i) => `Over ${i + 1}`),
      datasets: [
        {
          label: inningsIndex === 0 ? match.teamAName : match.teamBName,
          data,
          backgroundColor: inningsIndex === 0 ? 'rgba(56, 189, 248, 0.75)' : 'rgba(16, 185, 129, 0.75)',
          borderColor: inningsIndex === 0 ? '#38BDF8' : '#10B981',
          borderWidth: 1,
        },
      ],
    };
  };

  // 2. Worm Chart (Cumulative Runs)
  const getWormData = () => {
    const totalOvers = match.overs;
    const inn1Runs: number[] = [];
    const inn2Runs: number[] = [];

    let sum1 = 0;
    let sum2 = 0;

    for (let i = 0; i <= totalOvers * 6; i++) {
      const b1 = match.balls.find((b: any) => b.inningsIndex === 0 && (b.overNum * 6 + b.ballNum) === i);
      const b2 = match.balls.find((b: any) => b.inningsIndex === 1 && (b.overNum * 6 + b.ballNum) === i);

      if (b1) {
        sum1 += (b1.extrasType === 'wide' || b1.extrasType === 'noBall') ? (1 + b1.extraRuns) : b1.runs;
        if (i % 6 === 0) inn1Runs.push(sum1);
      }
      if (b2) {
        sum2 += (b2.extrasType === 'wide' || b2.extrasType === 'noBall') ? (1 + b2.extraRuns) : b2.runs;
        if (i % 6 === 0) inn2Runs.push(sum2);
      }
    }

    const labels = Array.from({ length: Math.max(inn1Runs.length, inn2Runs.length) }, (_, i) => `Over ${i}`);

    return {
      labels,
      datasets: [
        {
          label: match.teamAName,
          data: inn1Runs,
          fill: false,
          borderColor: '#38BDF8',
          tension: 0.2,
        },
        {
          label: match.teamBName,
          data: inn2Runs,
          fill: false,
          borderColor: '#10B981',
          tension: 0.2,
        },
      ],
    };
  };

  // Wagon Wheel shot coordinates (Mock Coordinates generated from balls data)
  const getWagonWheelShots = () => {
    // We map runs to angles (0-360 degrees) on a cricket field
    // 0 deg: Straight drive (long off/on), 90 deg: Midwicket/Square leg, 180 deg: Fine leg/Third man, 270 deg: Cover/Point
    return match.balls
      .filter((b: any) => b.inningsIndex === match.currentInnings && b.runs > 0 && !b.extrasType)
      .map((ball: any, idx: number) => {
        let angle = 0;
        // Seeded deterministic shot placement based on ball index to simulate coordinates
        if (ball.runs === 4) {
          angle = (idx * 67) % 360; // cover, midwicket, thirdman
        } else if (ball.runs === 6) {
          angle = (idx * 83) % 360; // long on, midwicket, cow corner
        } else {
          angle = (idx * 53) % 360; // singles all over
        }

        const rad = (angle * Math.PI) / 180;
        const length = 50 + (ball.runs * 15); // larger run = closer to boundary (max radius 150)
        const x = Math.round(150 + Math.sin(rad) * length);
        const y = Math.round(150 - Math.cos(rad) * length);

        let color = '#94A3B8';
        if (ball.runs === 4) color = '#F59E0B';
        if (ball.runs === 6) color = '#10B981';

        return { x, y, run: ball.runs, color };
      });
  };

  const wagonShots = getWagonWheelShots();

  return (
    <div className="min-h-screen bg-brand-bg text-gray-100 pb-16 print:bg-white print:text-black">
      {/* Navbar */}
      <div className="border-b border-slate-800 bg-slate-900/40 backdrop-blur-md px-4 py-4 print:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link to="/" className="p-2 hover:bg-slate-800 rounded-lg text-gray-400 hover:text-white transition-all">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h2 className="text-lg font-black text-white">Live Match Center</h2>
              <p className="text-xs text-gray-400">Real-time stats, insights, and visualizations</p>
            </div>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handlePrint}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-gray-300 hover:text-white rounded-lg transition-all"
              title="Print Scorecard / Save PDF"
            >
              <Printer className="w-4 h-4" />
            </button>
            <a
              href={`/api/matches/${id}/export`}
              download
              className="p-2 bg-slate-800 hover:bg-slate-700 text-gray-300 hover:text-white rounded-lg transition-all"
              title="Export CSV"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={fetchMatch}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-gray-300 hover:text-white rounded-lg transition-all"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Main scoreboard banner */}
        <div className="glass p-6 rounded-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 print:border print:border-black">
          <div className="absolute top-[-100px] left-[-100px] w-[300px] h-[300px] bg-brand-accent/5 rounded-full blur-[80px]" />
          
          <div className="text-center md:text-left space-y-2 z-10">
            <div className="flex items-center justify-center md:justify-start space-x-2">
              <span className="text-[10px] uppercase font-black px-2.5 py-0.5 bg-brand-danger/20 border border-brand-danger/30 text-brand-danger rounded-full animate-pulse print:border-black print:text-black">
                {match.status}
              </span>
              <span className="text-xs text-gray-400 font-bold uppercase">{match.format} • {match.overs} OVERS</span>
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                {match.teamAName} <span className="text-brand-accent text-lg">vs</span> {match.teamBName}
              </h1>
              {match.toss && (
                <p className="text-xs text-gray-400">
                  Toss: <strong>{match.toss.wonBy === match.teamAId ? match.teamAName : match.teamBName}</strong> won & decided to {match.toss.decision}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-8 z-10 shrink-0">
            {currentInnings ? (
              <div className="text-center md:text-right">
                <p className="text-xs text-gray-400 font-semibold tracking-wider uppercase mb-1">{battingTeamName} Innings</p>
                <div className="text-4xl font-black text-white tracking-tighter">
                  {currentInnings.runs} <span className="text-brand-accent">/</span> {currentInnings.wickets}
                </div>
                <p className="text-xs text-gray-400 font-medium mt-1">Overs: {currentInnings.overs} / {match.overs}</p>
              </div>
            ) : (
              <span className="text-sm text-gray-400 font-semibold italic">Lineups setting up...</span>
            )}
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex space-x-2 border-b border-slate-800/80 mt-8 mb-6 print:hidden">
          {(['live', 'scorecard', 'graphs'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-bold border-b-2 transition-all capitalize ${
                activeTab === tab ? 'border-brand-accent text-brand-accent' : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Live Tab View */}
        {activeTab === 'live' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left side: Batsman/Bowlers list + Last balls */}
            <div className="lg:col-span-2 space-y-6">
              {currentInnings && striker && nonStriker && bowler ? (
                <div className="glass p-5 rounded-xl space-y-6">
                  {/* Partnerships and run rates */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-b border-slate-800 pb-4 text-sm">
                    <div>
                      <span className="text-xs text-gray-400 block mb-0.5">Current Run Rate</span>
                      <strong className="text-white text-base">
                        {currentInnings.overs > 0 
                          ? (currentInnings.runs / (currentInnings.ballsBowled / 6)).toFixed(2) 
                          : '0.00'}
                      </strong>
                    </div>
                    {currentInnings.target && (
                      <div>
                        <span className="text-xs text-gray-400 block mb-0.5">Required Run Rate</span>
                        <strong className="text-white text-base">
                          {match.winProbability?.requiredRunRate || '0.00'}
                        </strong>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-gray-400 block mb-0.5">Partnership</span>
                      <strong className="text-white text-base">
                        {striker.runs + nonStriker.runs} runs ({striker.balls + nonStriker.balls} balls)
                      </strong>
                    </div>
                  </div>

                  {/* Batters Scorecard Grid */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Batting</h3>
                    <div className="grid grid-cols-12 text-xs font-semibold text-gray-400 uppercase pb-2 border-b border-slate-800/60">
                      <span className="col-span-6">Batsman</span>
                      <span className="col-span-2 text-right">R</span>
                      <span className="col-span-2 text-right">B</span>
                      <span className="col-span-2 text-right">SR</span>
                    </div>
                    {[striker, nonStriker].map((b) => (
                      <div key={b.playerId} className="grid grid-cols-12 text-sm text-white font-medium py-1.5 items-center">
                        <span className={`col-span-6 font-bold truncate ${b.isStriker ? 'text-brand-accent' : ''}`}>
                          {b.playerName} {b.isStriker ? '*' : ''}
                        </span>
                        <span className="col-span-2 text-right font-semibold">{b.runs}</span>
                        <span className="col-span-2 text-right text-gray-400">{b.balls}</span>
                        <span className="col-span-2 text-right text-gray-400">{b.strikeRate}</span>
                      </div>
                    ))}
                  </div>

                  {/* Bowler Grid */}
                  <div className="space-y-4 pt-4 border-t border-slate-800/80">
                    <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Bowling</h3>
                    <div className="grid grid-cols-12 text-xs font-semibold text-gray-400 uppercase pb-2 border-b border-slate-800/60">
                      <span className="col-span-6">Bowler</span>
                      <span className="col-span-2 text-right">O</span>
                      <span className="col-span-2 text-right">M</span>
                      <span className="col-span-2 text-right">R</span>
                      <span className="col-span-2 text-right">W</span>
                    </div>
                    <div className="grid grid-cols-12 text-sm text-white font-medium py-2">
                      <span className="col-span-6 font-bold truncate">{bowler.playerName}</span>
                      <span className="col-span-2 text-right">{bowler.overs}</span>
                      <span className="col-span-2 text-right text-gray-400">{bowler.maidens}</span>
                      <span className="col-span-2 text-right text-gray-400">{bowler.runsConceded}</span>
                      <span className="col-span-2 text-right text-brand-success font-bold">{bowler.wickets}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="glass p-6 text-center text-gray-500">
                  Waiting for scorer to setup innings play.
                </div>
              )}

              {/* Recent Balls Tracker */}
              {currentInnings && (
                <div className="glass p-5 rounded-xl space-y-4">
                  <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Recent Balls</h4>
                  <div className="flex flex-wrap gap-2.5">
                    {recentBalls.length === 0 ? (
                      <span className="text-xs text-gray-500 italic">No balls bowled in this innings yet.</span>
                    ) : (
                      recentBalls.map((b: any) => {
                        let badgeColor = 'bg-slate-900 border-slate-800 text-white';
                        if (b.runs === 4) badgeColor = 'bg-brand-warning/20 border-brand-warning/30 text-brand-warning';
                        if (b.runs === 6) badgeColor = 'bg-brand-success/20 border-brand-success/30 text-brand-success';
                        if (b.wicket) badgeColor = 'bg-brand-danger/25 border-brand-danger/35 text-brand-danger';

                        const runText = b.wicket ? 'W' : b.extrasType ? `${b.runs + b.extraRuns}${b.extrasType[0].toUpperCase()}` : b.runs;
                        return (
                          <div
                            key={b.id}
                            className={`w-9 h-9 flex items-center justify-center rounded-full border text-xs font-black transition-all ${badgeColor}`}
                            title={b.commentary}
                          >
                            {runText}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right side: AI Win Probability meter & Insights list */}
            <div className="space-y-6">
              {/* Radial/Bar Probability gauge */}
              {match.winProbability && (
                <div className="glass p-6 rounded-xl space-y-4 text-center">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">AI Win Predictor</h4>
                  
                  <div className="w-full bg-slate-900 rounded-full h-4 overflow-hidden flex border border-slate-800">
                    <div
                      style={{ width: `${match.winProbability.teamAProb}%` }}
                      className="bg-brand-accent transition-all duration-500"
                    />
                    <div
                      style={{ width: `${match.winProbability.teamBProb}%` }}
                      className="bg-brand-success transition-all duration-500"
                    />
                  </div>

                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-brand-accent">{match.teamAName}: {match.winProbability.teamAProb}%</span>
                    <span className="text-brand-success">{match.teamBName}: {match.winProbability.teamBProb}%</span>
                  </div>

                  {match.winProbability.projectedScore && (
                    <div className="pt-2 border-t border-slate-800/80 text-xs text-gray-400">
                      Projected Innings Score: <strong className="text-white">{match.winProbability.projectedScore}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Insights List */}
              {match.aiInsights && (
                <div className="glass p-5 rounded-xl space-y-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <TrendingUp className="w-4 h-4 text-brand-accent" />
                    <span>Match Insights</span>
                  </h4>
                  <ul className="space-y-3">
                    {match.aiInsights.map((insight: string, idx: number) => (
                      <li key={idx} className="text-xs text-gray-300 leading-relaxed border-l-2 border-brand-accent/50 pl-3">
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scorecard Tab View */}
        {activeTab === 'scorecard' && (
          <div className="space-y-8 print:block">
            {match.innings.map((inn: any, idx: number) => {
              const battingTeam = inn.battingTeamId === match.teamAId ? match.teamAName : match.teamBName;
              return (
                <div key={idx} className="glass p-6 rounded-2xl space-y-5 print:shadow-none print:border print:border-black">
                  <div className="flex justify-between items-center border-b border-slate-850 pb-3">
                    <h3 className="font-extrabold text-lg text-white">Innings {idx + 1}: {battingTeam}</h3>
                    <div className="text-right">
                      <span className="text-xl font-black text-white">{inn.runs} / {inn.wickets}</span>
                      <p className="text-xs text-gray-400">Overs: {inn.overs}</p>
                    </div>
                  </div>

                  {/* Batter scorecard */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 font-bold border-b border-slate-800 uppercase">
                          <th className="py-2">Batter</th>
                          <th className="py-2">Dismissal</th>
                          <th className="py-2 text-right">R</th>
                          <th className="py-2 text-right">B</th>
                          <th className="py-2 text-right">4s</th>
                          <th className="py-2 text-right">6s</th>
                          <th className="py-2 text-right">SR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inn.scorecard.batters.map((b: any) => (
                          <tr key={b.playerId} className="border-b border-slate-850/60 text-gray-200">
                            <td className="py-2.5 font-semibold text-white">{b.playerName}</td>
                            <td className="py-2.5 text-xs text-gray-400 italic">{b.outDetails || 'Not Out'}</td>
                            <td className="py-2.5 text-right font-bold text-white">{b.runs}</td>
                            <td className="py-2.5 text-right text-gray-400">{b.balls}</td>
                            <td className="py-2.5 text-right text-gray-400">{b.boundaries4}</td>
                            <td className="py-2.5 text-right text-gray-400">{b.boundaries6}</td>
                            <td className="py-2.5 text-right text-gray-400">{b.strikeRate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Bowler scorecard */}
                  <div className="overflow-x-auto pt-4 border-t border-slate-800/50">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 font-bold border-b border-slate-800 uppercase">
                          <th className="py-2">Bowler</th>
                          <th className="py-2 text-right">O</th>
                          <th className="py-2 text-right">M</th>
                          <th className="py-2 text-right">R</th>
                          <th className="py-2 text-right">W</th>
                          <th className="py-2 text-right">Econ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inn.scorecard.bowlers.map((bow: any) => (
                          <tr key={bow.playerId} className="border-b border-slate-850/60 text-gray-200">
                            <td className="py-2.5 font-semibold text-white">{bow.playerName}</td>
                            <td className="py-2.5 text-right font-medium">{bow.overs}</td>
                            <td className="py-2.5 text-right text-gray-400">{bow.maidens}</td>
                            <td className="py-2.5 text-right text-gray-400">{bow.runsConceded}</td>
                            <td className="py-2.5 text-right font-bold text-brand-success">{bow.wickets}</td>
                            <td className="py-2.5 text-right text-gray-400">{bow.economy}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Graphs Tab View */}
        {activeTab === 'graphs' && (
          <div className="space-y-12">
            {/* Worm Chart */}
            {inn1 && (
              <div className="glass p-6 rounded-2xl space-y-4">
                <h4 className="text-base font-bold text-white flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-brand-accent" />
                  <span>Match Worm Graph (Cumulative Runs)</span>
                </h4>
                <div className="h-[300px]">
                  <Line
                    data={getWormData()}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94A3B8' } },
                        x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94A3B8' } },
                      },
                    }}
                  />
                </div>
              </div>
            )}

            {/* Manhattan Graph */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {inn1 && (
                <div className="glass p-5 rounded-xl space-y-4">
                  <h4 className="text-sm font-bold text-gray-300">Manhattan - {match.teamAName}</h4>
                  <div className="h-[250px]">
                    <Bar
                      data={getManhattanData(0)}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          y: { ticks: { color: '#94A3B8' } },
                          x: { ticks: { color: '#94A3B8' } },
                        },
                      }}
                    />
                  </div>
                </div>
              )}

              {inn2 && (
                <div className="glass p-5 rounded-xl space-y-4">
                  <h4 className="text-sm font-bold text-gray-300">Manhattan - {match.teamBName}</h4>
                  <div className="h-[250px]">
                    <Bar
                      data={getManhattanData(1)}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          y: { ticks: { color: '#94A3B8' } },
                          x: { ticks: { color: '#94A3B8' } },
                        },
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Wagon Wheel Vector representation */}
            {currentInnings && (
              <div className="glass p-6 rounded-2xl flex flex-col md:flex-row items-center gap-8 justify-center">
                <div className="space-y-4 text-center md:text-left">
                  <h4 className="text-base font-bold text-white flex items-center justify-center md:justify-start space-x-2">
                    <BarChart3 className="w-5 h-5 text-brand-accent" />
                    <span>Wagon Wheel</span>
                  </h4>
                  <p className="text-xs text-gray-400 max-w-sm">
                    Visual plot of shots made by {battingTeamName} in the current innings. Lines represent direction and length of run scoring shots.
                  </p>
                  <div className="flex flex-col gap-2 pt-2 text-xs font-semibold">
                    <div className="flex items-center space-x-2">
                      <span className="w-3.5 h-3.5 bg-[#F59E0B] rounded-full" />
                      <span>Four Runs (Boundaries)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-3.5 h-3.5 bg-[#10B981] rounded-full" />
                      <span>Six Runs (Maximums)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-3.5 h-3.5 bg-[#94A3B8] rounded-full" />
                      <span>Singles & Runs</span>
                    </div>
                  </div>
                </div>

                {/* Cricket Field SVG Wagon Wheel */}
                <div className="relative w-[300px] h-[300px] bg-slate-900 rounded-full border-4 border-emerald-950 overflow-hidden flex items-center justify-center shadow-lg">
                  {/* Outer boundary circle */}
                  <div className="absolute w-[280px] h-[280px] rounded-full border border-dashed border-emerald-800/40" />
                  
                  {/* Pitch in center */}
                  <div className="absolute w-4 h-12 bg-[#F3E8FF]/20 rounded-sm border border-orange-200/10" />

                  {/* Draw Shot Lines */}
                  <svg className="absolute w-full h-full pointer-events-none">
                    {wagonShots.map((shot: any, idx: number) => (
                      <line
                        key={idx}
                        x1="150"
                        y1="150"
                        x2={shot.x}
                        y2={shot.y}
                        stroke={shot.color}
                        strokeWidth={shot.run >= 4 ? 2 : 1}
                        strokeDasharray={shot.run === 6 ? '1' : undefined}
                      />
                    ))}
                  </svg>

                  <span className="absolute bottom-2 text-[8px] font-bold text-gray-500 uppercase tracking-widest">Wagon Wheel</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
