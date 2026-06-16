import { Match } from './db.service';

export interface WinProbability {
  teamAProb: number; // Percentage (e.g. 60)
  teamBProb: number; // Percentage (e.g. 40)
  projectedScore?: number;
  requiredRunRate?: number;
  currentRunRate: number;
}

export class AIService {
  // Calculates real-time win probability
  static getWinProbability(match: Match): WinProbability {
    const currentInningsIndex = match.currentInnings;
    const innings = match.innings[currentInningsIndex];
    
    if (!innings) {
      return { teamAProb: 50, teamBProb: 50, currentRunRate: 0 };
    }

    const totalBalls = match.overs * 6;
    const ballsBowled = innings.ballsBowled;
    const runs = innings.runs;
    const wickets = innings.wickets;

    // Calculate current run rate
    const oversFaced = ballsBowled / 6;
    const crr = oversFaced > 0 ? runs / oversFaced : 0;
    const currentRunRate = Math.round(crr * 100) / 100;

    if (currentInningsIndex === 0) {
      // Innings 1: Predict project score and standard probability
      const ballsRemaining = totalBalls - ballsBowled;
      const projectedRuns = crr > 0 
        ? runs + (crr * (ballsRemaining / 6)) 
        : (match.overs * 8); // Default to 8 runs/over if start of match

      const projectedScore = Math.round(projectedRuns);
      
      // Probability starts 50-50, adjusted by CRR vs par (e.g., 8.0 rpo) and wickets lost
      const parCRR = 8.0;
      const wicketPenalty = wickets * 3.5;
      const crrBonus = (crr - parCRR) * 5;
      
      let teamAProb = 50 + crrBonus - wicketPenalty;
      teamAProb = Math.max(15, Math.min(85, teamAProb)); // Clamp between 15% and 85% in Innings 1
      const teamBProb = 100 - teamAProb;

      return {
        teamAProb: Math.round(teamAProb),
        teamBProb: Math.round(teamBProb),
        projectedScore,
        currentRunRate
      };
    } else {
      // Innings 2 (chase)
      const target = innings.target || (match.innings[0].runs + 1);
      const runsNeeded = target - runs;
      const ballsRemaining = totalBalls - ballsBowled;
      
      if (runsNeeded <= 0) {
        return { teamAProb: 0, teamBProb: 100, currentRunRate, requiredRunRate: 0 };
      }
      if (ballsRemaining <= 0) {
        return { teamAProb: 100, teamBProb: 0, currentRunRate, requiredRunRate: 99.9 };
      }
      if (wickets >= 10) {
        return { teamAProb: 100, teamBProb: 0, currentRunRate, requiredRunRate: 99.9 };
      }

      const rrr = (runsNeeded / (ballsRemaining / 6));
      const requiredRunRate = Math.round(rrr * 100) / 100;

      // Sigmoid/Logit calculation for win probability
      // Features: wickets left, RRR vs CRR, balls remaining
      const wicketsLeft = 10 - wickets;
      
      // Calculate a score: base score starts at 0.
      // High wickets left = positive, high RRR = negative.
      let x = (wicketsLeft / 10) * 4.0 - (rrr - crr) * 0.4 - (rrr > 18 ? (rrr - 18) * 1.5 : 0) - (runsNeeded / ballsRemaining) * 2;
      
      // Sigmoid function: 1 / (1 + exp(-x))
      const probabilityB = 1 / (1 + Math.exp(-x));
      let teamBProb = Math.round(probabilityB * 100);

      // Clamp limits based on extreme conditions
      if (wicketsLeft === 1 && runsNeeded > 12 && ballsRemaining < 6) {
        teamBProb = Math.min(teamBProb, 5); // very hard to win with 1 wicket left and high RRR
      }
      
      teamBProb = Math.max(1, Math.min(99, teamBProb));
      const teamAProb = 100 - teamBProb;

      return {
        teamAProb,
        teamBProb,
        requiredRunRate,
        currentRunRate
      };
    }
  }

  // Generates smart dynamic text insights for live matches
  static getMatchInsights(match: Match): string[] {
    const insights: string[] = [];
    const currentInningsIndex = match.currentInnings;
    const innings = match.innings[currentInningsIndex];

    if (!innings) return ['Match is starting soon!'];

    const crr = innings.ballsBowled > 0 ? innings.runs / (innings.ballsBowled / 6) : 0;
    const formattedCrr = crr.toFixed(2);

    // Insight 1: General rate info
    insights.push(`Current Run Rate: ${formattedCrr} runs per over.`);

    // Insight 2: Partnerships
    const activeBatters = innings.scorecard.batters.filter((b) => b.isStriker || b.isNonStriker);
    if (activeBatters.length === 2) {
      const pRuns = activeBatters[0].runs + activeBatters[1].runs;
      const pBalls = activeBatters[0].balls + activeBatters[1].balls;
      insights.push(`Partnership: ${pRuns} runs off ${pBalls} balls between ${activeBatters[0].playerName} and ${activeBatters[1].playerName}.`);
    }

    // Insight 3: Innings specific insights
    if (currentInningsIndex === 0) {
      const projected = Math.round(crr * match.overs);
      if (innings.overs > 2) {
        insights.push(`At this rate, ${match.teamAName} is projected to score around ${projected} runs.`);
      }
      if (innings.wickets >= 7) {
        insights.push(`Critical situation: ${match.teamAName} has lost ${innings.wickets} wickets. They must try to play out the full ${match.overs} overs.`);
      }
    } else {
      const target = innings.target || 0;
      const runsNeeded = target - innings.runs;
      const ballsRemaining = (match.overs * 6) - innings.ballsBowled;
      const rrr = (runsNeeded / (ballsRemaining / 6));

      insights.push(`Required: ${runsNeeded} runs needed from ${ballsRemaining} balls (Required Run Rate: ${rrr.toFixed(2)}).`);

      if (rrr > 12) {
        insights.push(`Pressure mounting: RRR is ${rrr.toFixed(2)}. ${match.teamBName} needs boundaries to keep up.`);
      } else if (rrr < 6 && (10 - innings.wickets) > 4) {
        insights.push(`Comfortable chase: ${match.teamBName} is in control. Single rotation should secure the victory.`);
      }

      if (innings.wickets >= 8 && runsNeeded > 15) {
        insights.push(`Tail-enders on crease. ${match.teamAName} is highly favored to defend.`);
      }
    }

    // Insight 4: Best performing bowler/batter
    const bowlers = innings.scorecard.bowlers;
    if (bowlers.length > 0) {
      const bestBowler = [...bowlers].sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)[0];
      if (bestBowler && bestBowler.wickets > 0) {
        insights.push(`Key bowler: ${bestBowler.playerName} has taken ${bestBowler.wickets} wickets with an economy of ${bestBowler.economy}.`);
      }
    }

    return insights;
  }
}
