'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/hooks/useSocket';

interface Reaction {
  id: number;
  type: string;
  x: number; // Random horizontal position
}

const EMOJI_MAP: Record<string, string> = {
  fire: '🔥',
  heart: '❤️',
  party: '🎉',
  poop: '💩'
};

export default function ReactionOverlay({ sessionId }: { sessionId: string }) {
  const { socket } = useSocket(sessionId);
  const [reactions, setReactions] = useState<Reaction[]>([]);

  useEffect(() => {
    if (!socket) return;

    socket.on('reaction', ({ type, id }) => {
      const newReaction = {
        id: id + Math.random(), // Ensure unique key if burst happens
        type,
        x: Math.random() * 80 + 10 // Random X between 10% and 90%
      };
      
      setReactions(prev => [...prev, newReaction]);

      // Cleanup after animation
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== newReaction.id));
      }, 3000);
    });

    return () => { socket.off('reaction'); };
  }, [socket]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <AnimatePresence>
        {reactions.map(r => (
          <motion.div
            key={r.id}
            initial={{ y: '100vh', opacity: 1, scale: 0.5, x: `${r.x}vw` }}
            animate={{ y: '20vh', opacity: 0, scale: 2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.5, ease: "easeOut" }}
            className="absolute text-6xl drop-shadow-lg"
          >
            {EMOJI_MAP[r.type]}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}