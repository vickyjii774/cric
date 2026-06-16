import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// Determine Socket URL based on environment
const SOCKET_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000' 
  : window.location.origin;

export const useSocket = (matchId?: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [matchData, setMatchData] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const s = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5
    });

    s.on('connect', () => {
      setIsConnected(true);
      if (matchId) {
        s.emit('join_match', matchId);
      }
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    s.on('match_update', (data: any) => {
      if (matchId && data.id === matchId) {
        setMatchData(data);
      }
    });

    setSocket(s);

    return () => {
      if (matchId) {
        s.emit('leave_match', matchId);
      }
      s.disconnect();
    };
  }, [matchId]);

  return { socket, matchData, setMatchData, isConnected };
};
export default useSocket;
