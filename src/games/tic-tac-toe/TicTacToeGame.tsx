'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Props {
  onGameOver: (score: number) => void;
}

type Cell = 'X' | 'O' | null;
type Board = Cell[];

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diags
];

function checkWinner(board: Board): { winner: Cell; line: number[] | null } {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return { winner: null, line: null };
}

function isFull(board: Board): boolean {
  return board.every((c) => c !== null);
}

function minimax(board: Board, isMax: boolean): number {
  const { winner } = checkWinner(board);
  if (winner === 'O') return 10;
  if (winner === 'X') return -10;
  if (isFull(board)) return 0;

  if (isMax) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = 'O';
        best = Math.max(best, minimax(board, false));
        board[i] = null;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) {
        board[i] = 'X';
        best = Math.min(best, minimax(board, true));
        board[i] = null;
      }
    }
    return best;
  }
}

function getAiMove(board: Board): number {
  // 30% chance of making a random (suboptimal) move
  const empties = board.map((c, i) => (c === null ? i : -1)).filter((i) => i !== -1);
  if (empties.length === 0) return -1;

  if (Math.random() < 0.3) {
    return empties[Math.floor(Math.random() * empties.length)];
  }

  let bestScore = -Infinity;
  let bestMove = empties[0];
  for (const i of empties) {
    board[i] = 'O';
    const score = minimax(board, false);
    board[i] = null;
    if (score > bestScore) {
      bestScore = score;
      bestMove = i;
    }
  }
  return bestMove;
}

export default function TicTacToeGame({ onGameOver }: Props) {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [result, setResult] = useState<string | null>(null);
  const [winLine, setWinLine] = useState<number[] | null>(null);
  const gameOverCalled = useRef(false);

  const resetGame = useCallback(() => {
    setBoard(Array(9).fill(null));
    setIsPlayerTurn(true);
    setResult(null);
    setWinLine(null);
    gameOverCalled.current = false;
  }, []);

  // Handle end state
  const handleEnd = useCallback(
    (winner: Cell, line: number[] | null) => {
      setWinLine(line);
      let score: number;
      let msg: string;
      if (winner === 'X') {
        score = 100;
        msg = 'You Win!';
      } else if (winner === 'O') {
        score = 0;
        msg = 'AI Wins!';
      } else {
        score = 50;
        msg = "It's a Draw!";
      }
      setResult(msg);
      if (!gameOverCalled.current) {
        gameOverCalled.current = true;
        setTimeout(() => onGameOver(score), 2000);
      }
    },
    [onGameOver]
  );

  // AI move
  useEffect(() => {
    if (isPlayerTurn || result) return;
    const timer = setTimeout(() => {
      const move = getAiMove([...board]);
      if (move === -1) return;
      const newBoard = [...board];
      newBoard[move] = 'O';
      setBoard(newBoard);
      setIsPlayerTurn(true);

      const { winner, line } = checkWinner(newBoard);
      if (winner || isFull(newBoard)) {
        handleEnd(winner, line);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [isPlayerTurn, board, result, handleEnd]);

  const handleClick = (i: number) => {
    if (!isPlayerTurn || board[i] || result) return;
    const newBoard = [...board];
    newBoard[i] = 'X';
    setBoard(newBoard);

    const { winner, line } = checkWinner(newBoard);
    if (winner || isFull(newBoard)) {
      handleEnd(winner, line);
    } else {
      setIsPlayerTurn(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <div className="flex items-center gap-4 text-sm font-semibold">
        <span className={`px-3 py-1 rounded-full ${isPlayerTurn && !result ? 'bg-cyan-500/20 text-cyan-400' : 'text-zinc-500'}`}>
          You (X)
        </span>
        <span className="text-zinc-600">vs</span>
        <span className={`px-3 py-1 rounded-full ${!isPlayerTurn && !result ? 'bg-pink-500/20 text-pink-400' : 'text-zinc-500'}`}>
          AI (O)
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {board.map((cell, i) => {
          const isWinCell = winLine?.includes(i);
          return (
            <button
              key={i}
              onClick={() => handleClick(i)}
              className={`
                w-20 h-20 sm:w-24 sm:h-24 rounded-xl
                flex items-center justify-center
                text-4xl sm:text-5xl font-black
                transition-all duration-200 cursor-pointer
                ${!cell && !result
                  ? 'bg-zinc-800 hover:bg-zinc-700 active:scale-95'
                  : 'bg-zinc-800/60'
                }
                ${isWinCell ? 'ring-2 ring-yellow-400 bg-yellow-400/10 scale-105' : ''}
                ${cell === 'X' ? 'text-cyan-400' : ''}
                ${cell === 'O' ? 'text-pink-400' : ''}
              `}
              aria-label={`Cell ${i + 1}: ${cell || 'empty'}`}
            >
              {cell && (
                <span className="ttt-pop">{cell}</span>
              )}
            </button>
          );
        })}
      </div>

      {result && (
        <div className="mt-1 text-center">
          <p
            className={`text-xl font-bold animate-bounce ${
              result.includes('Win') ? 'text-emerald-400' : result.includes('Draw') ? 'text-yellow-400' : 'text-red-400'
            }`}
          >
            {result}
          </p>
        </div>
      )}

      <style>{`
        @keyframes ttt-pop {
          0% { transform: scale(0); opacity: 0; }
          80% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        .ttt-pop { animation: ttt-pop 0.2s ease-out; }
      `}</style>
    </div>
  );
}
