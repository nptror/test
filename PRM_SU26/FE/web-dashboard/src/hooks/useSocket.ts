import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export const useSocket = (eventMap: { [eventName: string]: (data: any) => void }) => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    socketRef.current = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket'],
      reconnectionDelayMax: 10000,
      reconnectionAttempts: 10,
    });

    const socket = socketRef.current;

    // Dynamically register mapping events
    Object.entries(eventMap).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    socket.on('disconnect', (reason) => {
      console.warn('Socket disconnected due to:', reason);
    });

    return () => {
      Object.keys(eventMap).forEach((event) => {
        socket.off(event);
      });
      socket.disconnect();
    };
  }, [eventMap]);

  const emit = (event: string, payload: any) => {
    if (socketRef.current) {
      socketRef.current.emit(event, payload);
    }
  };

  return { emit };
};
