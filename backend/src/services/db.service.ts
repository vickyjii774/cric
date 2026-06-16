import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

// Interface Definitions
export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'super_admin' | 'organizer' | 'scorer' | 'viewer';
}

export interface PlayerStats {
  matches: number;
  runs: number;
  highestScore: number;
  strikeRate: number;
  average: number;
  boundaries4: number;
  boundaries6: number;
  wickets: number;
  bestFigures: string; // e.g. "5/12"
  economy: number;
}

export interface Player {
  id: string;
  name: string;
  jerseyNumber: string;
  battingStyle: 'right' | 'left';
  bowlingStyle: 'right-fast' | 'right-spin' | 'left-fast' | 'left-spin';
  role: 'batsman' | 'bowler' | 'allrounder' | 'wicketkeeper';
  stats: PlayerStats;
}

export interface Team {
  id: string;
  name: string;
  logo: string; // Base64 or URL
  squad: string[]; // Player IDs
  captain: string; // Player ID
  viceCaptain: string; // Player ID
  wicketKeeper: string; // Player ID
}

export interface Tournament {
  id: string;
  name: string;
  format: 'T10' | 'T20' | 'T30' | 'T50' | 'ODI' | 'Test' | 'Custom';
  organizerId: string;
  teams: string[]; // Team IDs
  matches: string[]; // Match IDs
  status: 'upcoming' | 'live' | 'completed';
}

export interface WicketDetails {
  batsmanId: string;
  type: 'bowled' | 'caught' | 'lbw' | 'runout' | 'stumped' | 'hit_wicket' | 'obstructing_field' | 'timed_out' | 'retired_hurt' | 'retired_out' | 'handled_ball' | 'hit_ball_twice' | 'mankad' | 'caught_bowled';
  bowlerId?: string;
  fielderId?: string;
  description: string;
}

export interface BallRecord {
  id: string;
  inningsIndex: number; // 0 or 1 (or 0-3 for Tests)
  overNum: number; // 0-indexed
  ballNum: number; // 1-indexed (1-6 for a clean over)
  bowlerId: string;
  batterId: string;
  nonStrikerId: string;
  runs: number; // runs from bat
  extrasType?: 'wide' | 'noBall' | 'bye' | 'legBye' | 'penalty';
  extraRuns: number;
  wicket?: WicketDetails;
  commentary: string;
  timestamp: number;
}

export interface BatterScore {
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

export interface BowlerScore {
  playerId: string;
  playerName: string;
  overs: number; // in decimal format: e.g. 3.4
  ballsBowled: number;
  runsConceded: number;
  wickets: number;
  maidens: number;
  economy: number;
}

export interface ExtrasState {
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
  penalty: number;
}

export interface InningsState {
  battingTeamId: string;
  bowlingTeamId: string;
  runs: number;
  wickets: number;
  overs: number; // decimal format (e.g. 15.2)
  ballsBowled: number;
  target?: number;
  isComplete: boolean;
  scorecard: {
    batters: BatterScore[];
    bowlers: BowlerScore[];
    extras: ExtrasState;
  };
}

export interface Match {
  id: string;
  tournamentId?: string;
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
  format: 'T10' | 'T20' | 'T30' | 'T50' | 'ODI' | 'Test' | 'Custom';
  overs: number;
  status: 'upcoming' | 'live' | 'completed';
  toss?: {
    wonBy: string; // Team ID
    decision: 'bat' | 'bowl';
  };
  currentInnings: number; // 0-indexed (0 or 1, or up to 3 for Tests)
  innings: InningsState[];
  balls: BallRecord[];
  winnerId?: string;
  nrr?: {
    teamA: number;
    teamB: number;
  };
  dlsCalculations?: {
    parScore?: number;
    oversTarget?: number;
  };
}

// Local Database Configuration
const DATA_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export class DBService {
  private static sheets: any = null;
  private static spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

  static async init() {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      try {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        const auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const client = await auth.getClient();
        this.sheets = google.sheets({ version: 'v4', auth: client as any });
        console.log('Google Sheets DB connection initialized.');
      } catch (err) {
        console.warn('Failed to initialize Google Sheets service account. Falling back to Local JSON database.', err);
      }
    } else {
      console.log('No Google Sheets config found. Using Local JSON database.');
    }
  }

  // Generic File DB Helpers
  private static getFilePath(table: string): string {
    return path.join(DATA_DIR, `${table}.json`);
  }

  private static readLocal<T>(table: string): T[] {
    const filePath = this.getFilePath(table);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([], null, 2));
      return [];
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    try {
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  private static writeLocal<T>(table: string, data: T[]): void {
    const filePath = this.getFilePath(table);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  // Google Sheets Helper: Sync database table to Google Sheet
  private static async syncToGoogleSheets(table: string, data: any[]) {
    if (!this.sheets || !this.spreadsheetId) return;
    try {
      // Create headers
      if (data.length === 0) return;
      const headers = Object.keys(data[0]);
      const rows = data.map((item) =>
        headers.map((h) => {
          const val = item[h];
          return typeof val === 'object' ? JSON.stringify(val) : val;
        })
      );
      const values = [headers, ...rows];

      // Try writing to a sheet named after the table
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${table}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values },
      });
    } catch (error) {
      console.error(`Google Sheets sync failed for table ${table}:`, error);
    }
  }

  // CRUD Operations
  static getAll<T>(table: string): T[] {
    return this.readLocal<T>(table);
  }

  static getById<T extends { id: string }>(table: string, id: string): T | undefined {
    const items = this.readLocal<T>(table);
    return items.find((item) => item.id === id);
  }

  static save<T extends { id: string }>(table: string, record: T): T {
    const items = this.readLocal<T>(table);
    const index = items.findIndex((item) => item.id === record.id);
    if (index >= 0) {
      items[index] = record;
    } else {
      items.push(record);
    }
    this.writeLocal(table, items);
    this.syncToGoogleSheets(table, items).catch(() => {});
    return record;
  }

  static delete(table: string, id: string): boolean {
    const items = this.readLocal<any>(table);
    const filtered = items.filter((item) => item.id !== id);
    if (filtered.length === items.length) return false;
    this.writeLocal(table, filtered);
    this.syncToGoogleSheets(table, filtered).catch(() => {});
    return true;
  }
}
