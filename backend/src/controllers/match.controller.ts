import { Request, Response } from 'express';
import { DBService, Match, Team, Player, InningsState, BallRecord } from '../services/db.service';
import { CricketService } from '../services/cricket.service';
import { AIService } from '../services/ai.service';
import { SocketService } from '../services/socket.service';

// Helper to seed players and teams if they don't exist
const ensureDefaultTeamsAndPlayers = (): { teamA: Team; teamB: Team } => {
  let teams = DBService.getAll<Team>('teams');
  let players = DBService.getAll<Player>('players');

  // If we don't have players, seed some
  if (players.length === 0) {
    const batStyles: Array<'left' | 'right'> = ['right', 'left', 'right', 'right', 'right'];
    const bowlStyles: Array<'right-fast' | 'right-spin' | 'left-fast' | 'left-spin'> = ['right-fast', 'right-spin', 'left-fast'];
    
    // Seed 11 players for Team A
    for (let i = 1; i <= 11; i++) {
      const p: Player = {
        id: `ply_a_${i}`,
        name: `A. Batter ${i}`,
        jerseyNumber: `${i * 7 % 99}`,
        battingStyle: batStyles[i % batStyles.length],
        bowlingStyle: bowlStyles[i % bowlStyles.length],
        role: i <= 5 ? 'batsman' : i <= 7 ? 'allrounder' : i === 8 ? 'wicketkeeper' : 'bowler',
        stats: { matches: 5, runs: 120 + i * 15, highestScore: 45 + i, strikeRate: 110 + i * 2, average: 24 + i, boundaries4: 12, boundaries6: 4, wickets: i > 6 ? i - 5 : 0, bestFigures: i > 6 ? `3/${12 + i}` : '0/0', economy: i > 6 ? 6.2 + i/10 : 0 }
      };
      DBService.save<Player>('players', p);
    }
    // Seed 11 players for Team B
    for (let i = 1; i <= 11; i++) {
      const p: Player = {
        id: `ply_b_${i}`,
        name: `B. Bowler ${i}`,
        jerseyNumber: `${i * 11 % 99}`,
        battingStyle: batStyles[i % batStyles.length],
        bowlingStyle: bowlStyles[i % bowlStyles.length],
        role: i <= 5 ? 'batsman' : i <= 7 ? 'allrounder' : i === 8 ? 'wicketkeeper' : 'bowler',
        stats: { matches: 5, runs: 80 + i * 10, highestScore: 35 + i, strikeRate: 105 + i * 2, average: 18 + i, boundaries4: 8, boundaries6: 2, wickets: i > 6 ? i - 4 : 0, bestFigures: i > 6 ? `2/${15 + i}` : '0/0', economy: i > 6 ? 7.1 + i/10 : 0 }
      };
      DBService.save<Player>('players', p);
    }
    players = DBService.getAll<Player>('players');
  }

  // If we don't have teams, seed them
  let teamA = teams.find((t) => t.id === 'tm_alliance');
  let teamB = teams.find((t) => t.id === 'tm_blasters');

  if (!teamA) {
    teamA = {
      id: 'tm_alliance',
      name: 'Alliance Warriors',
      logo: 'https://images.unsplash.com/photo-1540747737956-37872f747ee7?auto=format&fit=crop&q=80&w=120',
      squad: Array.from({ length: 11 }, (_, i) => `ply_a_${i + 1}`),
      captain: 'ply_a_1',
      viceCaptain: 'ply_a_2',
      wicketKeeper: 'ply_a_8'
    };
    DBService.save<Team>('teams', teamA);
  }
  if (!teamB) {
    teamB = {
      id: 'tm_blasters',
      name: 'Blasters United',
      logo: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=120',
      squad: Array.from({ length: 11 }, (_, i) => `ply_b_${i + 1}`),
      captain: 'ply_b_1',
      viceCaptain: 'ply_b_2',
      wicketKeeper: 'ply_b_8'
    };
    DBService.save<Team>('teams', teamB);
  }

  return { teamA, teamB };
};

export class MatchController {
  static listMatches = async (req: Request, res: Response) => {
    try {
      ensureDefaultTeamsAndPlayers();
      const matches = DBService.getAll<Match>('matches');
      return res.json(matches);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  static getMatch = async (req: Request, res: Response) => {
    try {
      const match = DBService.getById<Match>('matches', req.params.id);
      if (!match) {
        return res.status(404).json({ message: 'Match not found' });
      }

      // Append win prediction and AI insights
      const winProbability = AIService.getWinProbability(match);
      const aiInsights = AIService.getMatchInsights(match);

      return res.json({
        ...match,
        winProbability,
        aiInsights
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  static createMatch = async (req: Request, res: Response) => {
    try {
      const { teamAId, teamBId, format, overs } = req.body;
      const defaults = ensureDefaultTeamsAndPlayers();

      const tAId = teamAId || defaults.teamA.id;
      const tBId = teamBId || defaults.teamB.id;

      const teamA = DBService.getById<Team>('teams', tAId);
      const teamB = DBService.getById<Team>('teams', tBId);

      if (!teamA || !teamB) {
        return res.status(404).json({ message: 'One or both teams not found' });
      }

      const matchId = `match_${Date.now()}`;
      const newMatch: Match = {
        id: matchId,
        teamAId: tAId,
        teamBId: tBId,
        teamAName: teamA.name,
        teamBName: teamB.name,
        format: format || 'T20',
        overs: overs || 20,
        status: 'upcoming',
        currentInnings: 0,
        innings: [],
        balls: []
      };

      DBService.save<Match>('matches', newMatch);
      
      // Notify client list update
      SocketService.broadcastMatchUpdate(matchId, newMatch);

      return res.status(201).json(newMatch);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  static setToss = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { wonBy, decision } = req.body; // wonBy = team ID, decision = 'bat' | 'bowl'

      const match = DBService.getById<Match>('matches', id);
      if (!match) return res.status(404).json({ message: 'Match not found' });

      match.toss = { wonBy, decision };
      match.status = 'live';

      // Initialize Innings 1
      const battingTeamId = decision === 'bat' ? wonBy : (wonBy === match.teamAId ? match.teamBId : match.teamAId);
      const bowlingTeamId = battingTeamId === match.teamAId ? match.teamBId : match.teamAId;

      match.innings = [
        {
          battingTeamId,
          bowlingTeamId,
          runs: 0,
          wickets: 0,
          overs: 0,
          ballsBowled: 0,
          isComplete: false,
          scorecard: {
            batters: [],
            bowlers: [],
            extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 }
          }
        }
      ];

      DBService.save<Match>('matches', match);
      SocketService.broadcastMatchUpdate(match.id, match);

      return res.json(match);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  static setupActivePlayers = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { strikerId, nonStrikerId, bowlerId } = req.body;

      const match = DBService.getById<Match>('matches', id);
      if (!match) return res.status(404).json({ message: 'Match not found' });

      const innings = match.innings[match.currentInnings];
      if (!innings) return res.status(400).json({ message: 'Active innings not started yet' });

      // Load Player names
      const sPlayer = DBService.getById<Player>('players', strikerId);
      const nsPlayer = DBService.getById<Player>('players', nonStrikerId);
      const bPlayer = DBService.getById<Player>('players', bowlerId);

      if (!sPlayer || !nsPlayer || !bPlayer) {
        return res.status(400).json({ message: 'One or more players not found' });
      }

      // Add striker if not already in batter scorecard
      let sScore = innings.scorecard.batters.find((b) => b.playerId === strikerId);
      if (!sScore) {
        sScore = { playerId: strikerId, playerName: sPlayer.name, runs: 0, balls: 0, boundaries4: 0, boundaries6: 0, strikeRate: 0, isStriker: true, isNonStriker: false };
        innings.scorecard.batters.push(sScore);
      } else {
        sScore.isStriker = true;
        sScore.isNonStriker = false;
      }

      // Add non-striker
      let nsScore = innings.scorecard.batters.find((b) => b.playerId === nonStrikerId);
      if (!nsScore) {
        nsScore = { playerId: nonStrikerId, playerName: nsPlayer.name, runs: 0, balls: 0, boundaries4: 0, boundaries6: 0, strikeRate: 0, isStriker: false, isNonStriker: true };
        innings.scorecard.batters.push(nsScore);
      } else {
        nsScore.isStriker = false;
        nsScore.isNonStriker = true;
      }

      // Reset all other batters striker/non-striker flags
      innings.scorecard.batters.forEach((b) => {
        if (b.playerId !== strikerId && b.playerId !== nonStrikerId) {
          b.isStriker = false;
          b.isNonStriker = false;
        }
      });

      // Add bowler
      let bScore = innings.scorecard.bowlers.find((b) => b.playerId === bowlerId);
      if (!bScore) {
        bScore = { playerId: bowlerId, playerName: bPlayer.name, overs: 0, ballsBowled: 0, runsConceded: 0, wickets: 0, maidens: 0, economy: 0 };
        innings.scorecard.bowlers.push(bScore);
      } else {
        // Move bowler to end of list to make them the active bowler
        innings.scorecard.bowlers = innings.scorecard.bowlers.filter((b) => b.playerId !== bowlerId);
        innings.scorecard.bowlers.push(bScore);
      }

      DBService.save<Match>('matches', match);
      SocketService.broadcastMatchUpdate(match.id, match);

      return res.json(match);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  static addBall = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { runs, extrasType, extraRuns, wicket, commentary } = req.body;

      const updatedMatch = CricketService.addBall(id, { runs, extrasType, extraRuns, wicket, commentary });
      
      // Calculate prediction & insights for real-time
      const winProbability = AIService.getWinProbability(updatedMatch);
      const aiInsights = AIService.getMatchInsights(updatedMatch);

      const payload = {
        ...updatedMatch,
        winProbability,
        aiInsights
      };

      SocketService.broadcastMatchUpdate(id, payload);
      return res.json(payload);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  static undoBall = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updatedMatch = CricketService.undoBall(id);

      const winProbability = AIService.getWinProbability(updatedMatch);
      const aiInsights = AIService.getMatchInsights(updatedMatch);

      const payload = {
        ...updatedMatch,
        winProbability,
        aiInsights
      };

      SocketService.broadcastMatchUpdate(id, payload);
      return res.json(payload);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };

  static exportCSV = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const match = DBService.getById<Match>('matches', id);
      if (!match) return res.status(404).json({ message: 'Match not found' });

      // Build basic CSV content
      let csvContent = `CricketScorer Pro Match Scorecard - ${match.teamAName} vs ${match.teamBName}\n`;
      csvContent += `Format,${match.format},Overs,${match.overs},Status,${match.status}\n\n`;

      match.innings.forEach((inn, idx) => {
        const battingTeam = inn.battingTeamId === match.teamAId ? match.teamAName : match.teamBName;
        csvContent += `Innings ${idx + 1}: ${battingTeam} Batting\n`;
        csvContent += `Runs,${inn.runs},Wickets,${inn.wickets},Overs,${inn.overs}\n\n`;

        csvContent += `Batsman,Runs,Balls,4s,6s,SR,Dismissal\n`;
        inn.scorecard.batters.forEach((b) => {
          csvContent += `"${b.playerName}",${b.runs},${b.balls},${b.boundaries4},${b.boundaries6},${b.strikeRate},"${b.outDetails || 'Not Out'}"\n`;
        });
        csvContent += `\n`;

        csvContent += `Bowler,Overs,Runs Conceded,Wickets,Maidens,Economy\n`;
        inn.scorecard.bowlers.forEach((bow) => {
          csvContent += `"${bow.playerName}",${bow.overs},${bow.runsConceded},${bow.wickets},${bow.maidens},${bow.economy}\n`;
        });
        csvContent += `\n----------------------------------------------------\n\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=match_${id}_scorecard.csv`);
      return res.status(200).send(csvContent);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };
}
