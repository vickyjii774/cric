import { DBService, Match, BallRecord, InningsState, WicketDetails } from './db.service';

export class CricketService {
  // Add a ball delivery
  static addBall(matchId: string, input: {
    runs: number;
    extrasType?: 'wide' | 'noBall' | 'bye' | 'legBye' | 'penalty';
    extraRuns: number;
    wicket?: WicketDetails;
    commentary?: string;
  }): Match {
    const match = DBService.getById<Match>('matches', matchId);
    if (!match) throw new Error('Match not found');
    if (match.status !== 'live') throw new Error('Match is not live');

    const inningsIndex = match.currentInnings;
    let innings = match.innings[inningsIndex];
    if (!innings) {
      throw new Error('Active innings not found');
    }

    const { runs, extrasType, extraRuns, wicket } = input;

    // Find current striker & non-striker
    const striker = innings.scorecard.batters.find((b) => b.isStriker);
    const nonStriker = innings.scorecard.batters.find((b) => b.isNonStriker);
    
    // Find active bowler
    // A scorer would choose the current bowler; we look for the one with active state
    // For simplicity, we assume the last added bowler on the scorecard is the current bowler
    let bowler = innings.scorecard.bowlers[innings.scorecard.bowlers.length - 1];
    if (!bowler) {
      throw new Error('No bowler selected. Please select a bowler first.');
    }

    if (!striker || !nonStriker) {
      throw new Error('Active batsmen not found. Please set playing batsmen.');
    }

    // Determine if it's a legal delivery
    const isLegalBall = extrasType !== 'wide' && extrasType !== 'noBall';
    
    let totalRunsThisBall = 0;
    let bowlerConcededRuns = 0;

    // Calculate runs and extras
    if (extrasType === 'wide') {
      const wideRuns = 1 + extraRuns;
      totalRunsThisBall = wideRuns;
      bowlerConcededRuns = wideRuns;
      innings.scorecard.extras.wides += wideRuns;
    } else if (extrasType === 'noBall') {
      const noBallRuns = 1 + runs + extraRuns;
      totalRunsThisBall = noBallRuns;
      bowlerConcededRuns = 1 + runs + extraRuns;
      innings.scorecard.extras.noBalls += 1 + extraRuns;
      
      // Batter gets runs off bat credited
      striker.runs += runs;
      striker.balls += 1;
      if (runs === 4) striker.boundaries4 += 1;
      if (runs === 6) striker.boundaries6 += 1;
    } else if (extrasType === 'bye') {
      totalRunsThisBall = extraRuns;
      innings.scorecard.extras.byes += extraRuns;
      
      // Batter faces a ball but gets 0 runs
      striker.balls += 1;
    } else if (extrasType === 'legBye') {
      totalRunsThisBall = extraRuns;
      innings.scorecard.extras.legByes += extraRuns;
      
      // Batter faces a ball but gets 0 runs
      striker.balls += 1;
    } else if (extrasType === 'penalty') {
      totalRunsThisBall = extraRuns;
      innings.scorecard.extras.penalty += extraRuns;
      // Penalty does not affect bowler or batsman balls/runs
    } else {
      // Normal delivery
      totalRunsThisBall = runs;
      bowlerConcededRuns = runs;
      
      // Update striker stats
      striker.runs += runs;
      striker.balls += 1;
      if (runs === 4) striker.boundaries4 += 1;
      if (runs === 6) striker.boundaries6 += 1;
    }

    // Update bowler metrics for legal ball
    if (isLegalBall) {
      bowler.ballsBowled += 1;
      // Economy is updated later
    }
    bowler.runsConceded += bowlerConcededRuns;

    // Update innings total
    innings.runs += totalRunsThisBall;

    // Update batsman strike rates
    if (striker.balls > 0) {
      striker.strikeRate = Math.round((striker.runs / striker.balls) * 10000) / 100;
    }

    // Generate commentary if none provided
    const baseComm = input.commentary || `${bowler.playerName} to ${striker.playerName}: ${
      wicket ? 'OUT! ' + wicket.description : 
      extrasType ? `${extrasType.toUpperCase()} (${totalRunsThisBall} runs)` : 
      runs === 4 ? 'FOUR! Beautiful boundary.' : 
      runs === 6 ? 'SIX! Clean hit over the ropes.' : 
      runs === 0 ? 'No run.' : `${runs} run(s).`
    }`;

    // Handle wicket if any
    let dismissedBatsmanId = '';
    if (wicket) {
      innings.wickets += 1;
      dismissedBatsmanId = wicket.batsmanId;

      // Credit wicket to bowler if applicable
      const isBowlerWicket = ['bowled', 'caught', 'lbw', 'stumped', 'caught_bowled', 'hit_wicket'].includes(wicket.type);
      if (isBowlerWicket) {
        bowler.wickets += 1;
      }

      // Mark the batter as out
      const outBatter = innings.scorecard.batters.find((b) => b.playerId === wicket.batsmanId);
      if (outBatter) {
        outBatter.outDetails = wicket.description;
        outBatter.isStriker = false;
        outBatter.isNonStriker = false;
      }

      // If all out (10 wickets)
      if (innings.wickets >= 10) {
        innings.isComplete = true;
      }
    }

    // Calculate over values before strike rotation
    let newBallsBowled = innings.ballsBowled;
    if (isLegalBall) {
      newBallsBowled += 1;
      innings.ballsBowled = newBallsBowled;
    }
    
    // Decimal over format (e.g. 3.4 means 3 overs and 4 balls)
    const oversCount = Math.floor(newBallsBowled / 6);
    const overBalls = newBallsBowled % 6;
    innings.overs = oversCount + overBalls / 10;
    
    // Update bowler overs decimal format
    const bowlerOversCount = Math.floor(bowler.ballsBowled / 6);
    const bowlerOverBalls = bowler.ballsBowled % 6;
    bowler.overs = bowlerOversCount + bowlerOverBalls / 10;
    
    if (bowler.ballsBowled > 0) {
      bowler.economy = Math.round((bowler.runsConceded / (bowler.ballsBowled / 6)) * 100) / 100;
    }

    // Record the ball
    const ballId = `${matchId}_inn${inningsIndex}_balld_${Date.now()}`;
    const newBallRecord: BallRecord = {
      id: ballId,
      inningsIndex,
      overNum: oversCount,
      ballNum: isLegalBall ? overBalls || 6 : overBalls, // if wide, it keeps previous ball index
      bowlerId: bowler.playerId,
      batterId: striker.playerId,
      nonStrikerId: nonStriker.playerId,
      runs,
      extrasType,
      extraRuns,
      wicket,
      commentary: baseComm,
      timestamp: Date.now()
    };
    match.balls.push(newBallRecord);

    // Strike rotation logic:
    // Rotate strike on odd runs (if not a wicket or if it was a run-out of non-striker, etc.)
    const physicalRuns = (extrasType === 'wide' || extrasType === 'noBall') ? extraRuns : runs;
    const isOddRuns = physicalRuns % 2 !== 0;

    if (!wicket && isOddRuns) {
      // Rotate strike
      striker.isStriker = false;
      striker.isNonStriker = true;
      nonStriker.isStriker = true;
      nonStriker.isNonStriker = false;
    }

    // Over completion logic (6 legal balls)
    const isOverComplete = isLegalBall && overBalls === 0;
    if (isOverComplete) {
      // Check for Maiden Over
      // We look at the last 6 balls bowled. If runs conceded in this over is 0
      const currentOverBalls = match.balls.filter(
        (b) => b.inningsIndex === inningsIndex && b.overNum === oversCount - 1
      );
      const runsConcededInOver = currentOverBalls.reduce((acc, curr) => {
        let conceded = 0;
        if (curr.extrasType === 'wide' || curr.extrasType === 'noBall') {
          conceded += 1 + curr.extraRuns;
        } else {
          conceded += curr.runs;
        }
        return acc + conceded;
      }, 0);

      if (runsConcededInOver === 0) {
        bowler.maidens += 1;
      }

      // Rotate strike at the end of the over (unless the innings is complete)
      if (!innings.isComplete) {
        const curStriker = innings.scorecard.batters.find((b) => b.isStriker);
        const curNonStriker = innings.scorecard.batters.find((b) => b.isNonStriker);
        if (curStriker && curNonStriker) {
          curStriker.isStriker = false;
          curStriker.isNonStriker = true;
          curNonStriker.isStriker = true;
          curNonStriker.isNonStriker = false;
        }
      }
    }

    // Check innings completion (reached overs limit)
    if (innings.overs >= match.overs) {
      innings.isComplete = true;
    }

    // Check Match target chasing status (Innings 2)
    if (inningsIndex === 1 && innings.target) {
      if (innings.runs >= innings.target) {
        innings.isComplete = true;
        match.status = 'completed';
        match.winnerId = innings.battingTeamId;
      } else if (innings.isComplete && innings.runs < innings.target - 1) {
        match.status = 'completed';
        match.winnerId = innings.bowlingTeamId;
      } else if (innings.isComplete && innings.runs === innings.target - 1) {
        // Super Over / Tie
        match.status = 'completed';
        match.winnerId = 'tie';
      }
    }

    // If Innings 1 is completed and target is not set yet
    if (inningsIndex === 0 && innings.isComplete) {
      match.currentInnings = 1;
      // Setup Innings 2
      const targetScore = innings.runs + 1;
      match.innings.push({
        battingTeamId: match.teamBId, // Assuming team A bat first, team B chase
        bowlingTeamId: match.teamAId,
        runs: 0,
        wickets: 0,
        overs: 0,
        ballsBowled: 0,
        target: targetScore,
        isComplete: false,
        scorecard: {
          batters: [],
          bowlers: [],
          extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 }
        }
      });
    }

    // Recalculate Net Run Rate (NRR) if match completed
    if (match.status === 'completed') {
      const inn1 = match.innings[0];
      const inn2 = match.innings[1];
      if (inn1 && inn2) {
        // NRR team A = (Runs Scored / Overs Faced) - (Runs Conceded / Overs Bowled)
        const teamAOversFaced = inn1.isComplete && inn1.wickets === 10 ? match.overs : (inn1.ballsBowled / 6);
        const teamAOversBowled = inn2.isComplete && inn2.wickets === 10 ? match.overs : (inn2.ballsBowled / 6);
        
        const teamBOversFaced = inn2.isComplete && inn2.wickets === 10 ? match.overs : (inn2.ballsBowled / 6);
        const teamBOversBowled = inn1.isComplete && inn1.wickets === 10 ? match.overs : (inn1.ballsBowled / 6);

        const nrrA = (inn1.runs / (teamAOversFaced || 1)) - (inn2.runs / (teamAOversBowled || 1));
        const nrrB = (inn2.runs / (teamBOversFaced || 1)) - (inn1.runs / (teamBOversBowled || 1));

        match.nrr = {
          teamA: Math.round(nrrA * 1000) / 1000,
          teamB: Math.round(nrrB * 1000) / 1000,
        };
      }
    }

    // Save match
    DBService.save<Match>('matches', match);
    return match;
  }

  // Undo the last ball delivery
  static undoBall(matchId: string): Match {
    const match = DBService.getById<Match>('matches', matchId);
    if (!match) throw new Error('Match not found');
    if (match.balls.length === 0) return match;

    // Remove the last ball record
    const undoneBall = match.balls.pop()!;
    const inningsIndex = undoneBall.inningsIndex;
    match.currentInnings = inningsIndex; // revert current innings in case it advanced
    const innings = match.innings[inningsIndex];

    const isLegalBall = undoneBall.extrasType !== 'wide' && undoneBall.extrasType !== 'noBall';
    
    // Find batter and bowler
    const batter = innings.scorecard.batters.find((b) => b.playerId === undoneBall.batterId);
    const bowler = innings.scorecard.bowlers.find((b) => b.playerId === undoneBall.bowlerId);

    // Subtract runs and extras
    let totalRunsThisBall = 0;
    let bowlerConcededRuns = 0;

    if (undoneBall.extrasType === 'wide') {
      const wideRuns = 1 + undoneBall.extraRuns;
      totalRunsThisBall = wideRuns;
      bowlerConcededRuns = wideRuns;
      innings.scorecard.extras.wides -= wideRuns;
    } else if (undoneBall.extrasType === 'noBall') {
      const noBallRuns = 1 + undoneBall.runs + undoneBall.extraRuns;
      totalRunsThisBall = noBallRuns;
      bowlerConcededRuns = 1 + undoneBall.runs + undoneBall.extraRuns;
      innings.scorecard.extras.noBalls -= 1 + undoneBall.extraRuns;
      
      if (batter) {
        batter.runs -= undoneBall.runs;
        batter.balls -= 1;
        if (undoneBall.runs === 4) batter.boundaries4 -= 1;
        if (undoneBall.runs === 6) batter.boundaries6 -= 1;
      }
    } else if (undoneBall.extrasType === 'bye') {
      totalRunsThisBall = undoneBall.extraRuns;
      innings.scorecard.extras.byes -= undoneBall.extraRuns;
      if (batter) batter.balls -= 1;
    } else if (undoneBall.extrasType === 'legBye') {
      totalRunsThisBall = undoneBall.extraRuns;
      innings.scorecard.extras.legByes -= undoneBall.extraRuns;
      if (batter) batter.balls -= 1;
    } else if (undoneBall.extrasType === 'penalty') {
      totalRunsThisBall = undoneBall.extraRuns;
      innings.scorecard.extras.penalty -= undoneBall.extraRuns;
    } else {
      totalRunsThisBall = undoneBall.runs;
      bowlerConcededRuns = undoneBall.runs;
      if (batter) {
        batter.runs -= undoneBall.runs;
        batter.balls -= 1;
        if (undoneBall.runs === 4) batter.boundaries4 -= 1;
        if (undoneBall.runs === 6) batter.boundaries6 -= 1;
      }
    }

    if (isLegalBall && bowler) {
      bowler.ballsBowled -= 1;
    }
    if (bowler) {
      bowler.runsConceded -= bowlerConcededRuns;
    }
    innings.runs -= totalRunsThisBall;

    // Reset batter strike rate
    if (batter && batter.balls > 0) {
      batter.strikeRate = Math.round((batter.runs / batter.balls) * 10000) / 100;
    } else if (batter) {
      batter.strikeRate = 0;
    }

    // Handle wicket removal
    if (undoneBall.wicket) {
      innings.wickets -= 1;
      const outBatter = innings.scorecard.batters.find((b) => b.playerId === undoneBall.wicket!.batsmanId);
      if (outBatter) {
        outBatter.outDetails = undefined;
        // Reinstate striker/non-striker based on state
        // In simple undo, we set the dismissed batsman back as striker/non-striker
        // We'll mark them as striker for now (scorer can adjust if needed)
        outBatter.isStriker = true;
        
        // Find who was striker and make them non-striker
        const otherActive = innings.scorecard.batters.find((b) => b.isStriker && b.playerId !== outBatter.playerId);
        if (otherActive) {
          otherActive.isStriker = false;
          otherActive.isNonStriker = true;
        }
      }

      const isBowlerWicket = ['bowled', 'caught', 'lbw', 'stumped', 'caught_bowled', 'hit_wicket'].includes(undoneBall.wicket.type);
      if (isBowlerWicket && bowler) {
        bowler.wickets -= 1;
      }
    }

    // Revert ballsBowled count
    if (isLegalBall) {
      innings.ballsBowled -= 1;
    }

    // Recompute overs
    const oversCount = Math.floor(innings.ballsBowled / 6);
    const overBalls = innings.ballsBowled % 6;
    innings.overs = oversCount + overBalls / 10;

    if (bowler) {
      const bowlerOversCount = Math.floor(bowler.ballsBowled / 6);
      const bowlerOverBalls = bowler.ballsBowled % 6;
      bowler.overs = bowlerOversCount + bowlerOverBalls / 10;
      if (bowler.ballsBowled > 0) {
        bowler.economy = Math.round((bowler.runsConceded / (bowler.ballsBowled / 6)) * 100) / 100;
      } else {
        bowler.economy = 0;
      }
    }

    // Strike rotation revert:
    // If the ball triggered strike rotation, rotate it back
    const physicalRuns = (undoneBall.extrasType === 'wide' || undoneBall.extrasType === 'noBall') ? undoneBall.extraRuns : undoneBall.runs;
    const isOddRuns = physicalRuns % 2 !== 0;

    if (!undoneBall.wicket && isOddRuns) {
      // Revert strike
      const curStriker = innings.scorecard.batters.find((b) => b.isStriker);
      const curNonStriker = innings.scorecard.batters.find((b) => b.isNonStriker);
      if (curStriker && curNonStriker) {
        curStriker.isStriker = false;
        curStriker.isNonStriker = true;
        curNonStriker.isStriker = true;
        curNonStriker.isNonStriker = false;
      }
    }

    // Revert over completion rotation if it was the end of the over
    const wasOverEnd = isLegalBall && (innings.ballsBowled % 6 === 5); // since we already subtracted, it was 5 balls bowled
    if (wasOverEnd) {
      const curStriker = innings.scorecard.batters.find((b) => b.isStriker);
      const curNonStriker = innings.scorecard.batters.find((b) => b.isNonStriker);
      if (curStriker && curNonStriker) {
        curStriker.isStriker = false;
        curStriker.isNonStriker = true;
        curNonStriker.isStriker = true;
        curNonStriker.isNonStriker = false;
      }
      
      // Revert maiden check (done automatically as maidens are calculated per over)
      // If bowler was credited with a maiden, check if we need to decrement it
      // For simplicity, we can recalculate maidens by checking all balls
    }

    // Reset status
    match.status = 'live';
    innings.isComplete = false;
    match.winnerId = undefined;

    // If we were on innings 2 and went back to innings 1
    if (inningsIndex === 0 && match.innings.length > 1) {
      match.innings.pop(); // remove innings 2
    }

    DBService.save<Match>('matches', match);
    return match;
  }
}
