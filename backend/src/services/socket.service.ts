import { Server } from 'socket.io';

export class SocketService {
  private static io: Server | null = null;

  static init(ioInstance: Server) {
    this.io = ioInstance;
    
    this.io.on('connection', (socket) => {
      console.log(`Socket client connected: ${socket.id}`);

      // Allow clients to join a specific match room for updates
      socket.on('join_match', (matchId: string) => {
        socket.join(matchId);
        console.log(`Socket ${socket.id} joined room: ${matchId}`);
      });

      socket.on('leave_match', (matchId: string) => {
        socket.leave(matchId);
        console.log(`Socket ${socket.id} left room: ${matchId}`);
      });

      socket.on('disconnect', () => {
        console.log(`Socket client disconnected: ${socket.id}`);
      });
    });
  }

  static broadcastMatchUpdate(matchId: string, matchData: any) {
    if (!this.io) {
      console.warn('SocketService not initialized. Cannot broadcast.');
      return;
    }
    
    // Broadcast match updates to anyone in the room
    this.io.to(matchId).emit('match_update', matchData);
    
    // Also broadcast a general live match lists update to all users
    this.io.emit('live_matches_refresh');
  }
}
