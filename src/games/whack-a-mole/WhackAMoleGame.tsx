'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface WhackAMoleGameProps {
  onGameOver: (score: number) => void;
  level: 'easy' | 'medium' | 'hard';
}

const LEVEL_CONFIG = {
  easy:   { gameDuration: 45, initialMoleDuration: 2000, minMoleDuration: 900, spawnInterval: 1000, hasDecoys: false },
  medium: { gameDuration: 30, initialMoleDuration: 1200, minMoleDuration: 500, spawnInterval: 800,  hasDecoys: false },
  hard:   { gameDuration: 20, initialMoleDuration: 600,  minMoleDuration: 300, spawnInterval: 600,  hasDecoys: true },
} as const;

const GRID_SIZE = 9;
const SCORE_PER_WHACK = 10;
const DECOY_PENALTY = -5;

type HoleState = 'empty' | 'mole' | 'whacked' | 'decoy' | 'decoy-whacked';

export default function WhackAMoleGame({ onGameOver, level }: WhackAMoleGameProps) {
  const { gameDuration: GAME_DURATION, initialMoleDuration: INITIAL_MOLE_DURATION, minMoleDuration: MIN_MOLE_DURATION, spawnInterval: MOLE_SPAWN_INTERVAL, hasDecoys } = LEVEL_CONFIG[level];
  const [holes, setHoles] = useState<HoleState[]>(Array(GRID_SIZE).fill('empty'));
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(GAME_DURATION);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const scoreRef = useRef(0);
  const timeRef = useRef(GAME_DURATION);
  const holesRef = useRef<HoleState[]>(Array(GRID_SIZE).fill('empty'));
  const moleTimersRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const spawnIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedRef = useRef(0);

  const cleanup = useCallback(() => {
    moleTimersRef.current.forEach((timer) => clearTimeout(timer));
    moleTimersRef.current.clear();
    if (spawnIntervalRef.current) clearInterval(spawnIntervalRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
  }, []);

  const getMoleDuration = useCallback(() => {
    const elapsed = GAME_DURATION - timeRef.current;
    const progress = elapsed / GAME_DURATION;
    return Math.max(MIN_MOLE_DURATION, INITIAL_MOLE_DURATION - progress * (INITIAL_MOLE_DURATION - MIN_MOLE_DURATION));
  }, []);

  const spawnMole = useCallback(() => {
    if (timeRef.current <= 0) return;

    const emptyHoles: number[] = [];
    holesRef.current.forEach((state, i) => {
      if (state === 'empty') emptyHoles.push(i);
    });
    if (emptyHoles.length === 0) return;

    const idx = emptyHoles[Math.floor(Math.random() * emptyHoles.length)];
    const duration = getMoleDuration();

    // On hard mode, 25% chance to spawn a decoy (red mole)
    const isDecoy = hasDecoys && Math.random() < 0.25;
    holesRef.current[idx] = isDecoy ? 'decoy' : 'mole';
    setHoles([...holesRef.current]);

    const timer = setTimeout(() => {
      if (holesRef.current[idx] === 'mole' || holesRef.current[idx] === 'decoy') {
        holesRef.current[idx] = 'empty';
        setHoles([...holesRef.current]);
      }
      moleTimersRef.current.delete(idx);
    }, duration);

    moleTimersRef.current.set(idx, timer);
  }, [getMoleDuration]);

  const endGame = useCallback(() => {
    cleanup();
    setGameOver(true);
    onGameOver(scoreRef.current);
  }, [cleanup, onGameOver]);

  const startGame = useCallback(() => {
    setStarted(true);
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setGameOver(false);
    scoreRef.current = 0;
    timeRef.current = GAME_DURATION;
    elapsedRef.current = 0;
    holesRef.current = Array(GRID_SIZE).fill('empty');
    setHoles(Array(GRID_SIZE).fill('empty'));

    // Timer countdown
    timerIntervalRef.current = setInterval(() => {
      timeRef.current -= 1;
      setTimeLeft(timeRef.current);
      elapsedRef.current += 1;
      if (timeRef.current <= 0) {
        endGame();
      }
    }, 1000);

    // Spawn moles
    spawnMole();
    spawnIntervalRef.current = setInterval(() => {
      spawnMole();
      // Occasionally spawn a second mole later in the game
      if (elapsedRef.current > 10 && Math.random() > 0.5) {
        setTimeout(spawnMole, 200);
      }
    }, MOLE_SPAWN_INTERVAL);
  }, [endGame, spawnMole]);

  const whackMole = useCallback((idx: number) => {
    const holeState = holesRef.current[idx];
    if ((holeState !== 'mole' && holeState !== 'decoy') || gameOver) return;

    // Clear the hide timer
    const timer = moleTimersRef.current.get(idx);
    if (timer) {
      clearTimeout(timer);
      moleTimersRef.current.delete(idx);
    }

    if (holeState === 'decoy') {
      holesRef.current[idx] = 'decoy-whacked';
      setHoles([...holesRef.current]);
      scoreRef.current = Math.max(0, scoreRef.current + DECOY_PENALTY);
      setScore(scoreRef.current);
    } else {
      holesRef.current[idx] = 'whacked';
      setHoles([...holesRef.current]);
      scoreRef.current += SCORE_PER_WHACK;
      setScore(scoreRef.current);
    }

    // Show whacked state briefly then clear
    setTimeout(() => {
      holesRef.current[idx] = 'empty';
      setHoles([...holesRef.current]);
    }, 300);
  }, [gameOver]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const timerPercent = (timeLeft / GAME_DURATION) * 100;
  const timerColor = timeLeft > 10 ? 'bg-green-500' : timeLeft > 5 ? 'bg-yellow-500' : 'bg-red-500';

  if (!started || gameOver) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-6 min-h-[400px]">
        <div className="text-6xl">🐹</div>
        <h2 className="text-2xl font-bold text-white">Whack-a-Mole</h2>
        {gameOver && (
          <div className="text-center">
            <p className="text-4xl font-bold text-yellow-400 mb-2">{score}</p>
            <p className="text-gray-400">points</p>
          </div>
        )}
        <p className="text-gray-400 text-center max-w-xs">
          Tap the moles as they pop up! You have {GAME_DURATION} seconds.
        </p>
        <button
          onClick={startGame}
          className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl
            text-lg transition-all active:scale-95 shadow-lg shadow-green-900/40"
        >
          {gameOver ? 'Play Again' : 'Start Game'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-4 select-none">
      {/* HUD */}
      <div className="w-full max-w-[340px] flex items-center justify-between gap-4">
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Score</div>
          <div className="text-2xl font-bold text-yellow-400">{score}</div>
        </div>
        <div className="flex-1">
          <div className="text-xs text-gray-500 uppercase tracking-wider text-center mb-1">Time</div>
          <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${timerColor} rounded-full transition-all duration-1000 ease-linear`}
              style={{ width: `${timerPercent}%` }}
            />
          </div>
          <div className="text-center text-sm font-mono text-gray-400 mt-0.5">{timeLeft}s</div>
        </div>
      </div>

      {/* Game Grid */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 p-4 bg-green-900/40 rounded-2xl border border-green-800/50">
        {holes.map((state, i) => (
          <button
            key={i}
            onPointerDown={() => whackMole(i)}
            className={`
              relative w-20 h-20 sm:w-24 sm:h-24 rounded-full
              transition-all duration-100
              ${state === 'whacked'
                ? 'bg-yellow-900/60 scale-95'
                : 'bg-gradient-to-b from-amber-900 to-amber-950 shadow-inner'
              }
              border-2 border-amber-800/60
              flex items-center justify-center
              cursor-pointer active:scale-90
              overflow-hidden
            `}
            aria-label={state === 'mole' ? 'Whack this mole!' : state === 'decoy' ? 'Decoy mole!' : 'Empty hole'}
          >
            {/* Hole inner shadow */}
            <div className="absolute inset-2 rounded-full bg-gradient-to-b from-amber-950 to-black/60" />

            {/* Mole */}
            {state === 'mole' && (
              <div className="relative z-10 text-4xl sm:text-5xl wam-bounce-in select-none">
                🐹
              </div>
            )}

            {/* Decoy mole (red) */}
            {state === 'decoy' && (
              <div className="relative z-10 text-4xl sm:text-5xl wam-bounce-in select-none" style={{ filter: 'hue-rotate(320deg) saturate(2)' }}>
                🐹
              </div>
            )}

            {/* Whacked */}
            {state === 'whacked' && (
              <div className="relative z-10 text-4xl sm:text-5xl select-none wam-ping-once">
                💥
              </div>
            )}

            {/* Decoy whacked */}
            {state === 'decoy-whacked' && (
              <div className="relative z-10 text-4xl sm:text-5xl select-none wam-ping-once">
                ❌
              </div>
            )}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes wam-bounce-in {
          0% { transform: translateY(100%) scale(0.5); opacity: 0; }
          50% { transform: translateY(-10%) scale(1.1); }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes wam-ping-once {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .wam-bounce-in { animation: wam-bounce-in 0.2s ease-out forwards; }
        .wam-ping-once { animation: wam-ping-once 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
}
