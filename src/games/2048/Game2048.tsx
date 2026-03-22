'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Game2048Props {
  onGameOver: (score: number) => void;
  level: 'easy' | 'medium' | 'hard';
}

type Board = number[][];

const TILE_COLORS: Record<number, { bg: string; text: string }> = {
  0:    { bg: 'bg-gray-800/50', text: 'text-transparent' },
  2:    { bg: 'bg-gray-200', text: 'text-gray-800' },
  4:    { bg: 'bg-amber-100', text: 'text-gray-800' },
  8:    { bg: 'bg-orange-400', text: 'text-white' },
  16:   { bg: 'bg-red-500', text: 'text-white' },
  32:   { bg: 'bg-pink-500', text: 'text-white' },
  64:   { bg: 'bg-rose-700', text: 'text-white' },
  128:  { bg: 'bg-yellow-400', text: 'text-gray-900' },
  256:  { bg: 'bg-yellow-500', text: 'text-white' },
  512:  { bg: 'bg-yellow-600', text: 'text-white' },
  1024: { bg: 'bg-amber-500', text: 'text-white' },
  2048: { bg: 'bg-amber-400', text: 'text-white' },
};

function getColors(val: number) {
  return TILE_COLORS[val] || { bg: 'bg-purple-600', text: 'text-white' };
}

function createEmpty(size: number): Board {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

function cloneBoard(b: Board): Board {
  return b.map(row => [...row]);
}

function addRandom(board: Board, fourChance: number = 0.1): Board {
  const size = board.length;
  const empty: [number, number][] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === 0) empty.push([r, c]);
    }
  }
  if (empty.length === 0) return board;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const newBoard = cloneBoard(board);
  newBoard[r][c] = Math.random() < (1 - fourChance) ? 2 : 4;
  return newBoard;
}

function slideRow(row: number[]): { newRow: number[]; scored: number } {
  const size = row.length;
  // Remove zeros
  let filtered = row.filter(v => v !== 0);
  let scored = 0;
  // Merge
  for (let i = 0; i < filtered.length - 1; i++) {
    if (filtered[i] === filtered[i + 1]) {
      filtered[i] *= 2;
      scored += filtered[i];
      filtered[i + 1] = 0;
    }
  }
  filtered = filtered.filter(v => v !== 0);
  // Pad
  while (filtered.length < size) filtered.push(0);
  return { newRow: filtered, scored };
}

function rotateBoard(board: Board): Board {
  const size = board.length;
  const n = createEmpty(size);
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      n[c][size - 1 - r] = board[r][c];
  return n;
}

function move(board: Board, direction: 'left' | 'right' | 'up' | 'down'): { board: Board; scored: number; moved: boolean } {
  const size = board.length;
  let b = cloneBoard(board);
  let rotations = 0;
  if (direction === 'right') rotations = 2;
  else if (direction === 'up') rotations = 1;
  else if (direction === 'down') rotations = 3;

  for (let i = 0; i < rotations; i++) b = rotateBoard(b);

  let totalScored = 0;
  const newBoard = createEmpty(size);
  for (let r = 0; r < size; r++) {
    const { newRow, scored } = slideRow(b[r]);
    newBoard[r] = newRow;
    totalScored += scored;
  }

  // Rotate back
  let result = newBoard;
  for (let i = 0; i < (4 - rotations) % 4; i++) result = rotateBoard(result);

  const moved = JSON.stringify(result) !== JSON.stringify(board);
  return { board: result, scored: totalScored, moved };
}

function canMove(board: Board): boolean {
  const size = board.length;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === 0) return true;
      if (c < size - 1 && board[r][c] === board[r][c + 1]) return true;
      if (r < size - 1 && board[r][c] === board[r + 1][c]) return true;
    }
  }
  return false;
}

export default function Game2048({ onGameOver, level }: Game2048Props) {
  // Difficulty settings
  const gridSize = level === 'easy' ? 5 : 4;
  const initialTiles = level === 'easy' ? 3 : 2;
  const fourSpawnChance = level === 'hard' ? 0.25 : 0.1;
  const startWithFour = level === 'hard'; // one starting tile might be a 4

  const initBoard = useCallback((): Board => {
    let b = createEmpty(gridSize);
    for (let i = 0; i < initialTiles; i++) {
      if (startWithFour && i === 1) {
        // Second tile might be a 4 on hard
        b = addRandom(b, 0.5);
      } else {
        b = addRandom(b, 0);
      }
    }
    return b;
  }, [gridSize, initialTiles, startWithFour]);

  const [board, setBoard] = useState<Board>(() => initBoard());
  const [score, setScore] = useState(0);
  const [bestTile, setBestTile] = useState(2);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const scoreRef = useRef(0);
  const processingRef = useRef(false);

  const handleMove = useCallback((dir: 'left' | 'right' | 'up' | 'down') => {
    if (processingRef.current) return;
    processingRef.current = true;

    setBoard(prev => {
      const { board: newBoard, scored, moved } = move(prev, dir);
      if (!moved) {
        processingRef.current = false;
        return prev;
      }

      const withNew = addRandom(newBoard, fourSpawnChance);
      scoreRef.current += scored;
      setScore(scoreRef.current);

      // Find best tile
      let max = 0;
      const size = withNew.length;
      for (let r = 0; r < size; r++)
        for (let c = 0; c < size; c++)
          if (withNew[r][c] > max) max = withNew[r][c];
      setBestTile(max);

      if (!canMove(withNew)) {
        setGameOver(true);
        onGameOver(scoreRef.current);
      }

      processingRef.current = false;
      return withNew;
    });
  }, [onGameOver, fourSpawnChance]);

  // Keyboard
  useEffect(() => {
    if (!started || gameOver) return;
    const handler = (e: KeyboardEvent) => {
      const map: Record<string, 'left' | 'right' | 'up' | 'down'> = {
        ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
        a: 'left', d: 'right', w: 'up', s: 'down',
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        handleMove(dir);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [started, gameOver, handleMove]);

  // Touch / swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || gameOver) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const threshold = 30;

    if (Math.max(absDx, absDy) < threshold) return;

    if (absDx > absDy) {
      handleMove(dx > 0 ? 'right' : 'left');
    } else {
      handleMove(dy > 0 ? 'down' : 'up');
    }
    touchStartRef.current = null;
  };

  const startGame = useCallback(() => {
    const b = initBoard();
    setBoard(b);
    setScore(0);
    scoreRef.current = 0;
    setBestTile(2);
    setGameOver(false);
    setStarted(true);
  }, [initBoard]);

  const tileSize = (val: number) => {
    if (val >= 1024) return 'text-lg sm:text-xl';
    if (val >= 128) return 'text-xl sm:text-2xl';
    return 'text-2xl sm:text-3xl';
  };

  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-6 min-h-[400px]">
        <div className="text-6xl font-black text-amber-400">2048</div>
        <p className="text-gray-400 text-center max-w-xs">
          Swipe or use arrow keys to slide tiles. Merge matching numbers to reach 2048!
        </p>
        <button
          onClick={startGame}
          className="px-8 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl
            text-lg transition-all active:scale-95 shadow-lg shadow-amber-900/40"
        >
          Start Game
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
          <div className="text-2xl font-bold text-amber-400">{score}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Best Tile</div>
          <div className="text-2xl font-bold text-yellow-300">{bestTile}</div>
        </div>
      </div>

      {/* Board */}
      <div
        className="relative bg-gray-900 rounded-2xl p-2 sm:p-3 touch-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="grid gap-2 sm:gap-3"
          style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
        >
          {board.flat().map((val, i) => {
            const colors = getColors(val);
            const cellSize = gridSize === 5 ? 'w-14 h-14 sm:w-16 sm:h-16' : 'w-16 h-16 sm:w-20 sm:h-20';
            return (
              <div
                key={i}
                className={`
                  ${cellSize} rounded-lg flex items-center justify-center
                  font-bold ${tileSize(val)} transition-all duration-100
                  ${colors.bg} ${colors.text}
                  ${val > 0 ? 'shadow-md' : ''}
                `}
              >
                {val > 0 ? val : ''}
              </div>
            );
          })}
        </div>

        {/* Game Over overlay */}
        {gameOver && (
          <div className="absolute inset-0 bg-black/70 rounded-2xl flex flex-col items-center justify-center gap-4 backdrop-blur-sm">
            <p className="text-2xl font-bold text-white">Game Over!</p>
            <p className="text-4xl font-black text-amber-400">{score}</p>
            <button
              onClick={startGame}
              className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl
                transition-all active:scale-95"
            >
              Play Again
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-600">Swipe or use arrow keys</p>
    </div>
  );
}
