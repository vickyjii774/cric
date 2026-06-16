import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

import { DBService } from './services/db.service';
import { SocketService } from './services/socket.service';
import { AuthController } from './controllers/auth.controller';
import { MatchController } from './controllers/match.controller';
import { authenticateToken } from './middleware/auth.middleware';

// Load Env
dotenv.config();

const app = express();
const server = http.createServer(app);

// Configure CORS
app.use(cors({
  origin: '*', // For development flexibility
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Initialize Services
DBService.init().then(() => {
  console.log('Database system initialized.');
});

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
SocketService.init(io);

// Health Check API
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'CricketScorer Pro Backend', time: new Date() });
});

// Authentication Routes
app.post('/api/auth/register', AuthController.register);
app.post('/api/auth/login', AuthController.login);
app.get('/api/auth/me', AuthController.me);

// Match Routes
app.get('/api/matches', MatchController.listMatches);
app.get('/api/matches/:id', MatchController.getMatch);
app.post('/api/matches', authenticateToken, MatchController.createMatch);
app.post('/api/matches/:id/toss', authenticateToken, MatchController.setToss);
app.post('/api/matches/:id/players', authenticateToken, MatchController.setupActivePlayers);
app.post('/api/matches/:id/ball', authenticateToken, MatchController.addBall);
app.post('/api/matches/:id/undo', authenticateToken, MatchController.undoBall);
app.get('/api/matches/:id/export', MatchController.exportCSV);

// Error Handling Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`CricketScorer Pro Backend running on port ${PORT}`);
});
