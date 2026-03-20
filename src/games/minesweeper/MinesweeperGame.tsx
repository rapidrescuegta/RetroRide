'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface MinesweeperGameProps {
  onGameOver: (score: number) => void;
}

type CellState = {
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  adjacentMines: number;
};

const ROWS = 9;
const COLS = 9;
const MINES = 10;

function createEmptyGrid(): CellState[][] {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      isMine: false,
      isRevealed: false,
      isFlagged: false,
      adjacentMines: 0,
    }))
  );
}

function placeMines(grid: CellState[][], safeRow: number, safeCol: number): CellState[][] {
  const newGrid = grid.map(row => row.map(cell => ({ ...cell })));
  let placed = 0;

  // Safe zone: the clicked cell and its neighbors
  const isSafe = (r: number, c: number) =>
    Math.abs(r - safeRow) <= 1 && Math.abs(c - safeCol) <= 1;

  while (placed < MINES) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    if (!newGrid[r][c].isMine && !isSafe(r, c)) {
      newGrid[r][c].isMine = true;
      placed++;
    }
  }

  // Calculate adjacent counts
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (newGrid[r][c].isMine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && newGrid[nr][nc].isMine) {
            count++;
          }
        }
      }
      newGrid[r][c].adjacentMines = count;
    }
  }

  return newGrid;
}

function floodReveal(grid: CellState[][], row: number, col: number): CellState[][] {
  const newGrid = grid.map(r => r.map(c => ({ ...c })));
  const stack: [number, number][] = [[row, col]];

  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
    if (newGrid[r][c].isRevealed || newGrid[r][c].isFlagged || newGrid[r][c].isMine) continue;

    newGrid[r][c].isRevealed = true;

    if (newGrid[r][c].adjacentMines === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          stack.push([r + dr, c + dc]);
        }
      }
    }
  }

  return newGrid;
}

const NUMBER_COLORS: Record<number, string> = {
  1: 'text-blue-400',
  2: 'text-green-400',
  3: 'text-red-400',
  4: 'text-purple-400',
  5: 'text-orange-400',
  6: 'text-cyan-400',
  7: 'text-pink-400',
  8: 'text-gray-300',
};

export default function MinesweeperGame({ onGameOver }: MinesweeperGameProps) {
  const [grid, setGrid] = useState<CellState[][]>(createEmptyGrid);
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [timer, setTimer] = useState(0);
  const [flagCount, setFlagCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

  // Timer
  useEffect(() => {
    if (started && !gameOver) {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [started, gameOver]);

  const countRevealed = (g: CellState[][]) =>
    g.flat().filter(c => c.isRevealed && !c.isMine).length;

  const checkWin = useCallback((g: CellState[][]) => {
    const totalSafe = ROWS * COLS - MINES;
    return countRevealed(g) === totalSafe;
  }, []);

  const revealCell = useCallback((row: number, col: number) => {
    if (gameOver) return;

    let currentGrid = grid;

    // First click: place mines
    if (!started) {
      currentGrid = placeMines(currentGrid, row, col);
      setStarted(true);
    }

    const cell = currentGrid[row][col];
    if (cell.isRevealed || cell.isFlagged) return;

    if (cell.isMine) {
      // Game over - reveal all mines
      const newGrid = currentGrid.map(r => r.map(c => ({
        ...c,
        isRevealed: c.isMine ? true : c.isRevealed,
      })));
      // Mark the clicked mine
      newGrid[row][col] = { ...newGrid[row][col], isRevealed: true };
      setGrid(newGrid);
      setGameOver(true);
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeout(() => onGameOver(0), 1500);
      return;
    }

    const newGrid = floodReveal(currentGrid, row, col);
    setGrid(newGrid);

    if (checkWin(newGrid)) {
      setWon(true);
      setGameOver(true);
      if (timerRef.current) clearInterval(timerRef.current);
      const score = countRevealed(newGrid) * 10;
      setTimeout(() => onGameOver(score), 1500);
    }
  }, [grid, started, gameOver, checkWin, onGameOver]);

  const toggleFlag = useCallback((row: number, col: number) => {
    if (gameOver) return;
    const cell = grid[row][col];
    if (cell.isRevealed) return;

    const newGrid = grid.map(r => r.map(c => ({ ...c })));
    newGrid[row][col].isFlagged = !newGrid[row][col].isFlagged;
    setGrid(newGrid);
    setFlagCount(prev => newGrid[row][col].isFlagged ? prev + 1 : prev - 1);
  }, [grid, gameOver]);

  const handleContextMenu = (e: React.MouseEvent, row: number, col: number) => {
    e.preventDefault();
    toggleFlag(row, col);
  };

  const handleTouchStart = (row: number, col: number) => {
    longPressTriggered.current = false;
    longPressRef.current = setTimeout(() => {
      longPressTriggered.current = true;
      toggleFlag(row, col);
    }, 500);
  };

  const handleTouchEnd = (row: number, col: number) => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    if (!longPressTriggered.current) {
      revealCell(row, col);
    }
  };

  const handleTouchMove = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const renderCell = (cell: CellState, row: number, col: number) => {
    const base = 'w-[34px] h-[34px] sm:w-[40px] sm:h-[40px] flex items-center justify-center text-sm sm:text-base font-bold select-none transition-all duration-150';

    if (!cell.isRevealed) {
      return (
        <div
          key={`${row}-${col}`}
          className={`${base} bg-zinc-600 hover:bg-zinc-500 border border-zinc-500 rounded-sm cursor-pointer active:scale-95`}
          onClick={() => !longPressTriggered.current && revealCell(row, col)}
          onContextMenu={(e) => handleContextMenu(e, row, col)}
          onTouchStart={() => handleTouchStart(row, col)}
          onTouchEnd={() => handleTouchEnd(row, col)}
          onTouchMove={handleTouchMove}
        >
          {cell.isFlagged && <span className="text-red-400 text-lg">🚩</span>}
        </div>
      );
    }

    if (cell.isMine) {
      return (
        <div
          key={`${row}-${col}`}
          className={`${base} bg-red-600 border border-red-700 rounded-sm`}
        >
          <span className="text-lg">💣</span>
        </div>
      );
    }

    return (
      <div
        key={`${row}-${col}`}
        className={`${base} bg-zinc-800 border border-zinc-700/50 rounded-sm`}
      >
        {cell.adjacentMines > 0 && (
          <span className={NUMBER_COLORS[cell.adjacentMines] || 'text-white'}>
            {cell.adjacentMines}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full select-none">
      <h2 className="text-xl font-bold text-white tracking-wider">MINESWEEPER</h2>

      {/* Status bar */}
      <div className="flex items-center justify-between w-full max-w-[340px] sm:max-w-[400px] px-2">
        <div className="flex items-center gap-1.5 text-red-400 font-mono font-bold text-lg bg-zinc-800 px-3 py-1 rounded">
          🚩 {MINES - flagCount}
        </div>
        {won && (
          <div className="text-green-400 font-bold text-sm animate-pulse">
            YOU WIN!
          </div>
        )}
        {gameOver && !won && (
          <div className="text-red-400 font-bold text-sm animate-pulse">
            BOOM!
          </div>
        )}
        <div className="flex items-center gap-1.5 font-mono font-bold text-lg text-blue-400 bg-zinc-800 px-3 py-1 rounded">
          ⏱ {timer}s
        </div>
      </div>

      {/* Hint */}
      <p className="text-zinc-500 text-xs">
        Tap to reveal | Long-press or right-click to flag
      </p>

      {/* Grid */}
      <div
        className="inline-flex flex-col gap-[2px] p-2 bg-zinc-900 rounded-lg border border-zinc-700"
        style={{ touchAction: 'manipulation' }}
      >
        {grid.map((row, ri) => (
          <div key={ri} className="flex gap-[2px]">
            {row.map((cell, ci) => renderCell(cell, ri, ci))}
          </div>
        ))}
      </div>
    </div>
  );
}
