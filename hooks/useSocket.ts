import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { clientLogger } from '@/lib/clientLogger';

export const useSocket = (roomId: string) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Prevent connecting to empty room IDs (happens during initial render sometimes)
    if (!roomId) return;

    clientLogger.debug('Initializing Socket Connection', { roomId });

    const socket = io({
      path: '/api/socket',
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      clientLogger.info('Socket Connected', { socketId: socket.id, roomId });
      setIsConnected(true);
      socket.emit('join-room', roomId);
    });

    socket.on('connect_error', (err) => {
        clientLogger.error('Socket Connection Error', { message: err.message, roomId });
    });

    socket.on('disconnect', (reason) => {
      clientLogger.warn('Socket Disconnected', { reason, roomId });
      setIsConnected(false);
    });

    socket.on('reconnect', (attempt) => {
        clientLogger.info('Socket Reconnected', { attempt, roomId });
    });

    socketRef.current = socket;

    return () => {
      clientLogger.debug('Cleaning up Socket', { roomId });
      socket.disconnect();
    };
  }, [roomId]);

  return { socket: socketRef.current, isConnected };
};