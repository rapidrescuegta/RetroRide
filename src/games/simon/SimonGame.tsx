'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Props {
  onGameOver: (score: number) => void;
  level: 'easy' | 'medium' | 'hard';
}

const COLORS = [
  { name: 'red', bg: 'bg-red-700', active: 'bg-red-400', ring: 'ring-red-400' },
  { name: 'blue', bg: 'bg-blue-700', active: 'bg-blue-400', ring: 'ring-blue-400' },
  { name: 'green', bg: 'bg-green-700', active: 'bg-green-400', ring: 'ring-green-400' },
  { name: 'yellow', bg: 'bg-yellow-600', active: 'bg-yellow-300', ring: 'ring-yellow-300' },
];

export default function SimonGame({ onGameOver, level }: Props) {
  // Difficulty settings
  const playbackInterval = level === 'easy' ? 1000 : level === 'hard' ? 400 : 700;
  const playbackDuration = level === 'easy' ? 800 : level === 'hard' ? 300 : 500;
  const startSequenceLength = level === 'hard' ? 2 : 1;

  const [sequence, setSequence] = useState<number[]>([]);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [activeButton, setActiveButton] = useState<number | null>(null);
  const [phase, setPhase] = useState<'idle' | 'showing' | 'input' | 'gameover'>('idle');
  const [round, setRound] = useState(0);
  const [pulseButton, setPulseButton] = useState<number | null>(null);
  const gameOverCalled = useRef(false);

  // Start the game
  const startGame = useCallback(() => {
    const initial: number[] = [];
    for (let i = 0; i < startSequenceLength; i++) {
      initial.push(Math.floor(Math.random() * 4));
    }
    setSequence(initial);
    setRound(1);
    setPlayerIndex(0);
    setPhase('showing');
    gameOverCalled.current = false;
  }, [startSequenceLength]);

  // Show sequence to player
  useEffect(() => {
    if (phase !== 'showing') return;
    let i = 0;
    const timers: NodeJS.Timeout[] = [];

    // Brief pause before starting playback
    const startDelay = setTimeout(() => {
      const interval = setInterval(() => {
        if (i < sequence.length) {
          setActiveButton(sequence[i]);
          const offTimer = setTimeout(() => setActiveButton(null), playbackDuration);
          timers.push(offTimer);
          i++;
        } else {
          clearInterval(interval);
          setPhase('input');
          setPlayerIndex(0);
        }
      }, playbackInterval);
      timers.push(interval as unknown as NodeJS.Timeout);
    }, 400);
    timers.push(startDelay);

    return () => timers.forEach(clearTimeout);
  }, [phase, sequence]);

  const handlePress = useCallback(
    (colorIndex: number) => {
      if (phase !== 'input') return;

      // Visual feedback
      setActiveButton(colorIndex);
      setPulseButton(colorIndex);
      setTimeout(() => {
        setActiveButton(null);
        setPulseButton(null);
      }, 200);

      if (colorIndex !== sequence[playerIndex]) {
        // Wrong button - game over
        setPhase('gameover');
        const score = round - 1; // rounds completed (not counting current failed round)
        if (!gameOverCalled.current) {
          gameOverCalled.current = true;
          setTimeout(() => onGameOver(score), 1500);
        }
        return;
      }

      const nextIndex = playerIndex + 1;
      if (nextIndex === sequence.length) {
        // Completed round - add new color
        const nextColor = Math.floor(Math.random() * 4);
        setSequence((s) => [...s, nextColor]);
        setRound((r) => r + 1);
        setPlayerIndex(0);
        // Brief pause then show new sequence
        setTimeout(() => setPhase('showing'), 600);
      } else {
        setPlayerIndex(nextIndex);
      }
    },
    [phase, sequence, playerIndex, round, onGameOver]
  );

  // Keyboard support
  useEffect(() => {
    const keyMap: Record<string, number> = {
      '1': 0, 'q': 0,  // red (top-left)
      '2': 1, 'w': 1,  // blue (top-right)
      '3': 2, 'a': 2,  // green (bottom-left)
      '4': 3, 's': 3,  // yellow (bottom-right)
    };

    const handler = (e: KeyboardEvent) => {
      const idx = keyMap[e.key.toLowerCase()];
      if (idx !== undefined) handlePress(idx);
      if (e.key === ' ' && phase === 'idle') {
        e.preventDefault();
        startGame();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handlePress, phase, startGame]);

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <div className="flex items-center justify-between w-full max-w-[220px] px-1">
        <span className="text-sm font-semibold text-zinc-400">
          Round: <span className="text-white">{round}</span>
        </span>
        <span className="text-xs text-zinc-500">
          {phase === 'showing' && 'Watch...'}
          {phase === 'input' && 'Your turn!'}
          {phase === 'gameover' && 'Game Over!'}
        </span>
      </div>

      {phase === 'idle' ? (
        <button
          onClick={startGame}
          className="px-8 py-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700
            text-white font-bold text-lg shadow-lg shadow-indigo-500/30
            hover:from-indigo-500 hover:to-purple-600 active:scale-95
            transition-all duration-200 cursor-pointer"
        >
          Start Game
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {COLORS.map((color, i) => {
            const isActive = activeButton === i;
            const isPulsing = pulseButton === i;
            return (
              <button
                key={color.name}
                onClick={() => handlePress(i)}
                disabled={phase !== 'input'}
                className={`
                  w-24 h-24 sm:w-28 sm:h-28 rounded-2xl
                  transition-all duration-150
                  ${isActive ? `${color.active} shadow-lg shadow-current scale-105 ${color.ring} ring-4` : color.bg}
                  ${isPulsing ? 'animate-pulse' : ''}
                  ${phase === 'input' ? 'cursor-pointer active:scale-95 hover:brightness-110' : 'cursor-default'}
                  ${phase === 'gameover' ? 'opacity-50' : ''}
                `}
                aria-label={`${color.name} button`}
              />
            );
          })}
        </div>
      )}

      {phase === 'gameover' && (
        <div className="mt-1 text-center">
          <p className="text-xl font-bold text-red-400 animate-bounce">Game Over!</p>
          <p className="text-sm text-zinc-400">
            You completed <span className="text-white font-semibold">{round - 1}</span> round{round - 1 !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      <p className="text-xs text-zinc-600 mt-1">
        Keys: Q/W (top) A/S (bottom)
      </p>
    </div>
  );
}
