'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

interface ConnectFourGameProps {
  onGameOver: (score: number) => void;
}

const ROWS = 6;
const COLS = 7;

type Cell = 0 | 1 | 2; // 0=empty, 1=player(red), 2=AI(yellow)
type Board = Cell[][];

function createBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function cloneBoard(b: Board): Board {
  return b.map(row => [...row]);
}

function getAvailableRow(board: Board, col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === 0) return r;
  }
  return -1;
}

function checkWin(board: Board, player: Cell): [number, number][] | null {
  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      if (board[r][c] === player && board[r][c+1] === player &&
          board[r][c+2] === player && board[r][c+3] === player) {
        return [[r,c],[r,c+1],[r,c+2],[r,c+3]];
      }
    }
  }
  // Vertical
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === player && board[r+1][c] === player &&
          board[r+2][c] === player && board[r+3][c] === player) {
        return [[r,c],[r+1,c],[r+2,c],[r+3,c]];
      }
    }
  }
  // Diagonal down-right
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      if (board[r][c] === player && board[r+1][c+1] === player &&
          board[r+2][c+2] === player && board[r+3][c+3] === player) {
        return [[r,c],[r+1,c+1],[r+2,c+2],[r+3,c+3]];
      }
    }
  }
  // Diagonal down-left
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 3; c < COLS; c++) {
      if (board[r][c] === player && board[r+1][c-1] === player &&
          board[r+2][c-2] === player && board[r+3][c-3] === player) {
        return [[r,c],[r+1,c-1],[r+2,c-2],[r+3,c-3]];
      }
    }
  }
  return null;
}

function isBoardFull(board: Board): boolean {
  return board[0].every(cell => cell !== 0);
}

function countThreats(board: Board, player: Cell): number {
  let threats = 0;
  const opp: Cell = player === 1 ? 2 : 1;
  // Check all windows of 4
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of dirs) {
        const cells: Cell[] = [];
        for (let i = 0; i < 4; i++) {
          const nr = r + dr * i, nc = c + dc * i;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
          cells.push(board[nr][nc]);
        }
        if (cells.length === 4) {
          const mine = cells.filter(v => v === player).length;
          const theirs = cells.filter(v => v === opp).length;
          if (mine === 3 && theirs === 0) threats++;
          if (mine === 2 && theirs === 0) threats += 0.3;
        }
      }
    }
  }
  return threats;
}

function aiMove(board: Board): number {
  const available: number[] = [];
  for (let c = 0; c < COLS; c++) {
    if (getAvailableRow(board, c) !== -1) available.push(c);
  }
  if (available.length === 0) return -1;

  // 1. Check if AI can win
  for (const c of available) {
    const b = cloneBoard(board);
    const r = getAvailableRow(b, c);
    b[r][c] = 2;
    if (checkWin(b, 2)) return c;
  }

  // 2. Block player win
  for (const c of available) {
    const b = cloneBoard(board);
    const r = getAvailableRow(b, c);
    b[r][c] = 1;
    if (checkWin(b, 1)) return c;
  }

  // 3. Score each column
  let bestScore = -Infinity;
  let bestCols: number[] = [];
  for (const c of available) {
    const b = cloneBoard(board);
    const r = getAvailableRow(b, c);
    b[r][c] = 2;

    // Don't give opponent a winning move above
    let givesWin = false;
    if (r > 0) {
      const b2 = cloneBoard(b);
      b2[r-1][c] = 1;
      if (checkWin(b2, 1)) givesWin = true;
    }

    let colScore = 0;
    colScore += countThreats(b, 2) * 10;
    colScore -= countThreats(b, 1) * 8;
    // Prefer center
    colScore += (3 - Math.abs(c - 3)) * 2;
    if (givesWin) colScore -= 50;

    if (colScore > bestScore) {
      bestScore = colScore;
      bestCols = [c];
    } else if (colScore === bestScore) {
      bestCols.push(c);
    }
  }

  return bestCols[Math.floor(Math.random() * bestCols.length)];
}

export default function ConnectFourGame({ onGameOver }: ConnectFourGameProps) {
  const [board, setBoard] = useState<Board>(createBoard);
  const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [winner, setWinner] = useState<0 | 1 | 2>(0);
  const [winCells, setWinCells] = useState<[number, number][]>([]);
  const [droppingCol, setDroppingCol] = useState<number | null>(null);
  const [droppingRow, setDroppingRow] = useState<number>(-1);
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const aiThinking = useRef(false);

  const isWinCell = (r: number, c: number) =>
    winCells.some(([wr, wc]) => wr === r && wc === c);

  const dropPiece = useCallback((col: number, player: 1 | 2) => {
    const row = getAvailableRow(board, col);
    if (row === -1 || gameOver) return;

    // Animate drop
    setDroppingCol(col);
    setDroppingRow(row);

    setTimeout(() => {
      const newBoard = cloneBoard(board);
      newBoard[row][col] = player;
      setBoard(newBoard);
      setDroppingCol(null);
      setDroppingRow(-1);

      const win = checkWin(newBoard, player);
      if (win) {
        setWinCells(win);
        setWinner(player);
        setGameOver(true);
        onGameOver(player === 1 ? 100 : 0);
        return;
      }

      if (isBoardFull(newBoard)) {
        setWinner(0);
        setGameOver(true);
        onGameOver(50);
        return;
      }

      setCurrentPlayer(player === 1 ? 2 : 1);
    }, 300);
  }, [board, gameOver, onGameOver]);

  // AI turn
  useEffect(() => {
    if (currentPlayer === 2 && !gameOver && started && !aiThinking.current) {
      aiThinking.current = true;
      const timer = setTimeout(() => {
        const col = aiMove(board);
        if (col !== -1) dropPiece(col, 2);
        aiThinking.current = false;
      }, 500);
      return () => { clearTimeout(timer); aiThinking.current = false; };
    }
  }, [currentPlayer, gameOver, started, board, dropPiece]);

  const handleColumnClick = (col: number) => {
    if (currentPlayer !== 1 || gameOver || droppingCol !== null) return;
    dropPiece(col, 1);
  };

  const startGame = () => {
    setBoard(createBoard());
    setCurrentPlayer(1);
    setGameOver(false);
    setWinner(0);
    setWinCells([]);
    setDroppingCol(null);
    setDroppingRow(-1);
    setStarted(true);
    aiThinking.current = false;
  };

  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-6 min-h-[400px]">
        <div className="flex gap-2 text-5xl">
          <span className="text-red-500">&#9679;</span>
          <span className="text-yellow-400">&#9679;</span>
        </div>
        <h2 className="text-2xl font-bold text-white">Connect Four</h2>
        <p className="text-gray-400 text-center max-w-xs">
          Drop pieces to connect four in a row. You are red, AI is yellow.
        </p>
        <button
          onClick={startGame}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl
            text-lg transition-all active:scale-95 shadow-lg shadow-blue-900/40"
        >
          Start Game
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-4 select-none">
      {/* Status */}
      <div className="text-center">
        {gameOver ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-xl font-bold text-white">
              {winner === 1 ? 'You Win!' : winner === 2 ? 'AI Wins!' : 'Draw!'}
            </p>
            <p className="text-3xl font-black text-yellow-400">
              {winner === 1 ? '100' : winner === 0 ? '50' : '0'} pts
            </p>
            <button
              onClick={startGame}
              className="mt-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl
                transition-all active:scale-95"
            >
              Play Again
            </button>
          </div>
        ) : (
          <p className="text-lg font-semibold">
            {currentPlayer === 1 ? (
              <span className="text-red-400">Your turn</span>
            ) : (
              <span className="text-yellow-400">AI thinking...</span>
            )}
          </p>
        )}
      </div>

      {/* Board */}
      <div className="bg-blue-700 rounded-2xl p-2 sm:p-3 shadow-2xl shadow-blue-900/60">
        {/* Column hover indicators */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-1 px-1">
          {Array.from({ length: COLS }).map((_, c) => (
            <div key={c} className="flex justify-center h-6">
              {hoverCol === c && currentPlayer === 1 && !gameOver && (
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-red-500/40 -mt-1" />
              )}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid gap-1.5 sm:gap-2">
          {board.map((row, r) => (
            <div key={r} className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {row.map((cell, c) => {
                const isDrop = droppingCol === c && droppingRow === r;
                return (
                  <button
                    key={c}
                    onClick={() => handleColumnClick(c)}
                    onMouseEnter={() => setHoverCol(c)}
                    onMouseLeave={() => setHoverCol(null)}
                    className={`
                      w-10 h-10 sm:w-12 sm:h-12 rounded-full
                      transition-all duration-150
                      ${cell === 0 && !isDrop
                        ? 'bg-blue-900 shadow-inner'
                        : ''
                      }
                      ${cell === 1 || (isDrop && currentPlayer === 1)
                        ? `bg-red-500 shadow-md shadow-red-900/50 ${isWinCell(r, c) ? 'ring-4 ring-white animate-pulse' : ''}`
                        : ''
                      }
                      ${cell === 2 || (isDrop && currentPlayer === 2)
                        ? `bg-yellow-400 shadow-md shadow-yellow-900/50 ${isWinCell(r, c) ? 'ring-4 ring-white animate-pulse' : ''}`
                        : ''
                      }
                      ${isDrop ? 'cf-drop' : ''}
                      ${currentPlayer === 1 && !gameOver && cell === 0 ? 'cursor-pointer hover:bg-blue-800' : 'cursor-default'}
                    `}
                    aria-label={`Column ${c + 1}, Row ${r + 1}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes cf-drop {
          0% { transform: translateY(-200px); opacity: 0.7; }
          60% { transform: translateY(10px); }
          80% { transform: translateY(-5px); }
          100% { transform: translateY(0); opacity: 1; }
        }
        .cf-drop { animation: cf-drop 0.3s ease-in forwards; }
      `}</style>
    </div>
  );
}
