'use client';

import { useState, useEffect, useCallback } from 'react';
import { playSound } from '@/lib/audio';

interface Props {
  onGameOver: (score: number) => void;
  level: 'easy' | 'medium' | 'hard';
}

const ALL_EMOJIS = ['🐶', '🐱', '🐭', '🐰', '🦊', '🐸', '🐵', '🦁', '🐯', '🐼'];

const LEVEL_CONFIG = {
  easy:   { pairs: 3, cols: 3 },
  medium: { pairs: 8, cols: 4 },
  hard:   { pairs: 10, cols: 5 },
} as const;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MemoryMatchGame({ onGameOver, level }: Props) {
  const { pairs, cols } = LEVEL_CONFIG[level];
  const EMOJIS = ALL_EMOJIS.slice(0, pairs);
  const [cards, setCards] = useState<string[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  // Initialize board
  useEffect(() => {
    setCards(shuffle([...EMOJIS, ...EMOJIS]));
  }, []);

  const handleClick = useCallback(
    (index: number) => {
      if (locked || flipped.includes(index) || matched.has(index) || gameOver) return;

      const newFlipped = [...flipped, index];
      setFlipped(newFlipped);
      playSound('memory_flip');

      if (newFlipped.length === 2) {
        setMoves((m) => m + 1);
        setLocked(true);

        const [a, b] = newFlipped;
        if (cards[a] === cards[b]) {
          // Match found
          playSound('memory_match');
          const newMatched = new Set(matched);
          newMatched.add(a);
          newMatched.add(b);
          setMatched(newMatched);
          setFlipped([]);
          setLocked(false);

          // Check win
          if (newMatched.size === cards.length) {
            setGameOver(true);
            playSound('memory_game_over');
            const score = Math.max(100 - (moves + 1) * 5, 10);
            setTimeout(() => onGameOver(score), 1200);
          }
        } else {
          // No match — flip back
          playSound('memory_no_match');
          setTimeout(() => {
            setFlipped([]);
            setLocked(false);
          }, 800);
        }
      }
    },
    [flipped, matched, locked, cards, moves, gameOver, onGameOver]
  );

  const isRevealed = (i: number) => flipped.includes(i) || matched.has(i);

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <div className="flex items-center justify-between w-full max-w-xs px-2">
        <span className="text-sm font-semibold text-zinc-400">
          Moves: <span className="text-white">{moves}</span>
        </span>
        <span className="text-sm font-semibold text-zinc-400">
          Matched: <span className="text-white">{matched.size / 2}/{EMOJIS.length}</span>
        </span>
      </div>

      <div className={`grid gap-2 sm:gap-3`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {cards.map((emoji, i) => {
          const revealed = isRevealed(i);
          const isMatched = matched.has(i);
          return (
            <button
              key={i}
              onClick={() => handleClick(i)}
              className={`
                relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl cursor-pointer
                transition-transform duration-300 preserve-3d
                ${revealed ? '[transform:rotateY(180deg)]' : ''}
                ${isMatched ? 'ring-2 ring-emerald-400 scale-95' : ''}
              `}
              style={{ perspective: '600px', transformStyle: 'preserve-3d' }}
              aria-label={revealed ? emoji : 'Hidden card'}
            >
              {/* Card back */}
              <div
                className={`
                  absolute inset-0 rounded-xl flex items-center justify-center
                  bg-gradient-to-br from-indigo-600 to-purple-700
                  shadow-lg shadow-indigo-500/20 backface-hidden
                  transition-all duration-200
                  ${!revealed ? 'hover:from-indigo-500 hover:to-purple-600 hover:scale-105' : ''}
                `}
                style={{ backfaceVisibility: 'hidden' }}
              >
                <span className="text-2xl sm:text-3xl opacity-60">?</span>
              </div>

              {/* Card front */}
              <div
                className={`
                  absolute inset-0 rounded-xl flex items-center justify-center
                  bg-zinc-800 border border-zinc-700
                  shadow-lg backface-hidden
                  ${isMatched ? 'bg-emerald-900/40 border-emerald-500/50' : ''}
                `}
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
              >
                <span className="text-3xl sm:text-4xl">{emoji}</span>
              </div>
            </button>
          );
        })}
      </div>

      {gameOver && (
        <div className="mt-2 text-center animate-bounce">
          <p className="text-xl font-bold text-emerald-400">All matched!</p>
          <p className="text-sm text-zinc-400">
            Score: {Math.max(100 - moves * 5, 10)}
          </p>
        </div>
      )}
    </div>
  );
}
