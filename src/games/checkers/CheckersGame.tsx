'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

interface CheckersGameProps {
  onGameOver: (score: number) => void;
}

type Piece = null | 'red' | 'black' | 'red-king' | 'black-king';
type Board = Piece[][];

function isRed(p: Piece): boolean { return p === 'red' || p === 'red-king'; }
function isBlack(p: Piece): boolean { return p === 'black' || p === 'black-king'; }
function isKing(p: Piece): boolean { return p === 'red-king' || p === 'black-king'; }

function createBoard(): Board {
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) board[r][c] = 'black';
    }
  }
  for (let r = 5; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) board[r][c] = 'red';
    }
  }
  return board;
}

function cloneBoard(b: Board): Board { return b.map(row => [...row]); }

function getJumps(board: Board, r: number, c: number): [number, number, number, number][] {
  const piece = board[r][c];
  if (!piece) return [];
  const jumps: [number, number, number, number][] = [];
  const dirs: [number, number][] = [];

  if (isRed(piece) || isKing(piece)) dirs.push([-1, -1], [-1, 1]);
  if (isBlack(piece) || isKing(piece)) dirs.push([1, -1], [1, 1]);

  for (const [dr, dc] of dirs) {
    const mr = r + dr, mc = c + dc;
    const jr = r + 2 * dr, jc = c + 2 * dc;
    if (jr < 0 || jr >= 8 || jc < 0 || jc >= 8) continue;
    const mid = board[mr][mc];
    if (!mid) continue;
    if (isRed(piece) && isBlack(mid) && !board[jr][jc]) jumps.push([jr, jc, mr, mc]);
    if (isBlack(piece) && isRed(mid) && !board[jr][jc]) jumps.push([jr, jc, mr, mc]);
  }
  return jumps;
}

function getMoves(board: Board, r: number, c: number): [number, number][] {
  const piece = board[r][c];
  if (!piece) return [];
  const moves: [number, number][] = [];
  const dirs: [number, number][] = [];

  if (isRed(piece) || isKing(piece)) dirs.push([-1, -1], [-1, 1]);
  if (isBlack(piece) || isKing(piece)) dirs.push([1, -1], [1, 1]);

  for (const [dr, dc] of dirs) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
    if (!board[nr][nc]) moves.push([nr, nc]);
  }
  return moves;
}

function hasAnyJumps(board: Board, isRedPlayer: boolean): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (isRedPlayer ? isRed(p) : isBlack(p)) {
        if (getJumps(board, r, c).length > 0) return true;
      }
    }
  }
  return false;
}

function getAllMoves(board: Board, isRedPlayer: boolean): { from: [number, number]; to: [number, number]; jump?: [number, number] }[] {
  const allMoves: { from: [number, number]; to: [number, number]; jump?: [number, number] }[] = [];
  const mustJump = hasAnyJumps(board, isRedPlayer);

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (isRedPlayer ? !isRed(p) : !isBlack(p)) continue;

      if (mustJump) {
        for (const [jr, jc, mr, mc] of getJumps(board, r, c)) {
          allMoves.push({ from: [r, c], to: [jr, jc], jump: [mr, mc] });
        }
      } else {
        for (const [nr, nc] of getMoves(board, r, c)) {
          allMoves.push({ from: [r, c], to: [nr, nc] });
        }
      }
    }
  }
  return allMoves;
}

function applyMove(board: Board, from: [number, number], to: [number, number], jump?: [number, number]): Board {
  const b = cloneBoard(board);
  b[to[0]][to[1]] = b[from[0]][from[1]];
  b[from[0]][from[1]] = null;
  if (jump) b[jump[0]][jump[1]] = null;

  // King promotion
  if (to[0] === 0 && b[to[0]][to[1]] === 'red') b[to[0]][to[1]] = 'red-king';
  if (to[0] === 7 && b[to[0]][to[1]] === 'black') b[to[0]][to[1]] = 'black-king';

  return b;
}

function evaluateBoard(board: Board): number {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p === 'black') score += 3 + (r * 0.5);
      else if (p === 'black-king') score += 7;
      else if (p === 'red') score -= 3 + ((7 - r) * 0.5);
      else if (p === 'red-king') score -= 7;
    }
  }
  return score;
}

function minimax(board: Board, depth: number, isMaximizing: boolean, alpha: number, beta: number): number {
  const moves = getAllMoves(board, isMaximizing ? false : true);
  const movesAI = getAllMoves(board, isMaximizing ? true : false);

  if (depth === 0) return evaluateBoard(board);

  // Current player's moves
  const currentMoves = isMaximizing ? getAllMoves(board, false) : getAllMoves(board, true);
  if (currentMoves.length === 0) return isMaximizing ? -100 : 100;

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of currentMoves) {
      const newBoard = applyMove(board, move.from, move.to, move.jump);
      // Check multi-jump
      let finalBoard = newBoard;
      if (move.jump) {
        let moreJumps = getJumps(newBoard, move.to[0], move.to[1]);
        let pos = move.to;
        while (moreJumps.length > 0) {
          const [jr, jc, mr, mc] = moreJumps[0];
          finalBoard = applyMove(finalBoard, pos, [jr, jc], [mr, mc]);
          pos = [jr, jc];
          moreJumps = getJumps(finalBoard, jr, jc);
        }
      }
      const eval_ = minimax(finalBoard, depth - 1, false, alpha, beta);
      maxEval = Math.max(maxEval, eval_);
      alpha = Math.max(alpha, eval_);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of currentMoves) {
      const newBoard = applyMove(board, move.from, move.to, move.jump);
      let finalBoard = newBoard;
      if (move.jump) {
        let moreJumps = getJumps(newBoard, move.to[0], move.to[1]);
        let pos = move.to;
        while (moreJumps.length > 0) {
          const [jr, jc, mr, mc] = moreJumps[0];
          finalBoard = applyMove(finalBoard, pos, [jr, jc], [mr, mc]);
          pos = [jr, jc];
          moreJumps = getJumps(finalBoard, jr, jc);
        }
      }
      const eval_ = minimax(finalBoard, depth - 1, true, alpha, beta);
      minEval = Math.min(minEval, eval_);
      beta = Math.min(beta, eval_);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function aiMove(board: Board): { from: [number, number]; to: [number, number]; jump?: [number, number] } | null {
  const moves = getAllMoves(board, false); // black = AI
  if (moves.length === 0) return null;

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    const newBoard = applyMove(board, move.from, move.to, move.jump);
    let finalBoard = newBoard;
    if (move.jump) {
      let moreJumps = getJumps(newBoard, move.to[0], move.to[1]);
      let pos = move.to;
      while (moreJumps.length > 0) {
        const [jr, jc, mr, mc] = moreJumps[0];
        finalBoard = applyMove(finalBoard, pos, [jr, jc], [mr, mc]);
        pos = [jr, jc];
        moreJumps = getJumps(finalBoard, jr, jc);
      }
    }
    const score = minimax(finalBoard, 2, false, -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}

export default function CheckersGame({ onGameOver }: CheckersGameProps) {
  const [board, setBoard] = useState<Board>(createBoard);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [validMoves, setValidMoves] = useState<[number, number][]>([]);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [gameEnded, setGameEnded] = useState(false);
  const [message, setMessage] = useState('Your turn! Tap a red piece.');
  const [multiJumpPos, setMultiJumpPos] = useState<[number, number] | null>(null);
  const gameOverCalledRef = useRef(false);

  const countPieces = useCallback((b: Board) => {
    let red = 0, black = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (isRed(b[r][c])) red++;
        if (isBlack(b[r][c])) black++;
      }
    }
    return { red, black };
  }, []);

  const checkGameOver = useCallback((b: Board, nextIsPlayer: boolean) => {
    const { red, black } = countPieces(b);
    if (red === 0) {
      setGameEnded(true);
      setMessage('You lose!');
      if (!gameOverCalledRef.current) { gameOverCalledRef.current = true; setTimeout(() => onGameOver(0), 1500); }
      return true;
    }
    if (black === 0) {
      setGameEnded(true);
      setMessage('You win!');
      if (!gameOverCalledRef.current) { gameOverCalledRef.current = true; setTimeout(() => onGameOver(100), 1500); }
      return true;
    }
    const moves = getAllMoves(b, nextIsPlayer);
    if (moves.length === 0) {
      setGameEnded(true);
      if (nextIsPlayer) {
        setMessage('No moves! You lose.');
        if (!gameOverCalledRef.current) { gameOverCalledRef.current = true; setTimeout(() => onGameOver(0), 1500); }
      } else {
        setMessage('AI stuck! You win!');
        if (!gameOverCalledRef.current) { gameOverCalledRef.current = true; setTimeout(() => onGameOver(100), 1500); }
      }
      return true;
    }
    return false;
  }, [countPieces, onGameOver]);

  // AI turn
  useEffect(() => {
    if (isPlayerTurn || gameEnded) return;

    const timer = setTimeout(() => {
      const move = aiMove(board);
      if (!move) {
        checkGameOver(board, false);
        return;
      }

      let newBoard = applyMove(board, move.from, move.to, move.jump);

      // AI multi-jump
      if (move.jump) {
        let pos = move.to;
        let moreJumps = getJumps(newBoard, pos[0], pos[1]);
        while (moreJumps.length > 0) {
          const [jr, jc, mr, mc] = moreJumps[0];
          newBoard = applyMove(newBoard, pos, [jr, jc], [mr, mc]);
          pos = [jr, jc];
          moreJumps = getJumps(newBoard, jr, jc);
        }
      }

      setBoard(newBoard);
      if (!checkGameOver(newBoard, true)) {
        setIsPlayerTurn(true);
        setMessage('Your turn!');
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [isPlayerTurn, board, gameEnded, checkGameOver]);

  const handleClick = (r: number, c: number) => {
    if (!isPlayerTurn || gameEnded) return;

    const mustJump = hasAnyJumps(board, true);

    // If multi-jumping, only allow continuing the jump
    if (multiJumpPos) {
      const jumps = getJumps(board, multiJumpPos[0], multiJumpPos[1]);
      const jumpTarget = jumps.find(([jr, jc]) => jr === r && jc === c);
      if (jumpTarget) {
        const [jr, jc, mr, mc] = jumpTarget;
        const newBoard = applyMove(board, multiJumpPos, [jr, jc], [mr, mc]);
        setBoard(newBoard);

        // Check for more jumps
        const moreJumps = getJumps(newBoard, jr, jc);
        if (moreJumps.length > 0) {
          setMultiJumpPos([jr, jc]);
          setSelected([jr, jc]);
          setValidMoves(moreJumps.map(([jr2, jc2]) => [jr2, jc2]));
          setMessage('Multi-jump! Keep going!');
          return;
        }

        setMultiJumpPos(null);
        setSelected(null);
        setValidMoves([]);
        if (!checkGameOver(newBoard, false)) {
          setIsPlayerTurn(false);
          setMessage('AI thinking...');
        }
        return;
      }
      return;
    }

    // Select a piece
    if (isRed(board[r][c])) {
      const jumps = getJumps(board, r, c);
      if (mustJump) {
        if (jumps.length === 0) {
          setMessage('You must jump! Pick a piece that can jump.');
          return;
        }
        setSelected([r, c]);
        setValidMoves(jumps.map(([jr, jc]) => [jr, jc]));
      } else {
        const moves = getMoves(board, r, c);
        if (moves.length === 0 && jumps.length === 0) {
          setMessage('No moves for that piece.');
          return;
        }
        setSelected([r, c]);
        setValidMoves([...moves, ...jumps.map(([jr, jc]) => [jr, jc] as [number, number])]);
      }
      return;
    }

    // Move to a valid square
    if (selected) {
      const isValid = validMoves.some(([vr, vc]) => vr === r && vc === c);
      if (isValid) {
        const jumps = getJumps(board, selected[0], selected[1]);
        const jumpTarget = jumps.find(([jr, jc]) => jr === r && jc === c);

        if (jumpTarget) {
          const [jr, jc, mr, mc] = jumpTarget;
          const newBoard = applyMove(board, selected, [jr, jc], [mr, mc]);
          setBoard(newBoard);

          // Check for more jumps from new position
          const moreJumps = getJumps(newBoard, jr, jc);
          if (moreJumps.length > 0) {
            setMultiJumpPos([jr, jc]);
            setSelected([jr, jc]);
            setValidMoves(moreJumps.map(([jr2, jc2]) => [jr2, jc2]));
            setMessage('Multi-jump! Keep going!');
            return;
          }

          setSelected(null);
          setValidMoves([]);
          if (!checkGameOver(newBoard, false)) {
            setIsPlayerTurn(false);
            setMessage('AI thinking...');
          }
        } else {
          const newBoard = applyMove(board, selected, [r, c]);
          setBoard(newBoard);
          setSelected(null);
          setValidMoves([]);
          if (!checkGameOver(newBoard, false)) {
            setIsPlayerTurn(false);
            setMessage('AI thinking...');
          }
        }
      } else {
        setSelected(null);
        setValidMoves([]);
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <div className="text-white font-mono text-sm px-2">{message}</div>
      <div className="inline-block border-4 border-amber-900 rounded-lg overflow-hidden shadow-2xl">
        {board.map((row, r) => (
          <div key={r} className="flex">
            {row.map((cell, c) => {
              const isDark = (r + c) % 2 === 1;
              const isSelected = selected?.[0] === r && selected?.[1] === c;
              const isValidTarget = validMoves.some(([vr, vc]) => vr === r && vc === c);

              return (
                <div
                  key={c}
                  onClick={() => handleClick(r, c)}
                  className={`
                    w-[46px] h-[46px] sm:w-[48px] sm:h-[48px] flex items-center justify-center cursor-pointer relative
                    transition-colors duration-150
                    ${isDark ? 'bg-amber-800' : 'bg-amber-200'}
                    ${isSelected ? 'ring-3 ring-yellow-400 ring-inset z-10' : ''}
                    ${isValidTarget ? 'bg-green-600/60' : ''}
                  `}
                >
                  {cell && (
                    <div
                      className={`
                        w-[34px] h-[34px] sm:w-[36px] sm:h-[36px] rounded-full
                        flex items-center justify-center text-xs font-bold
                        shadow-lg transition-transform duration-150
                        ${isRed(cell)
                          ? 'bg-gradient-to-br from-red-500 to-red-700 border-2 border-red-400'
                          : 'bg-gradient-to-br from-gray-700 to-gray-900 border-2 border-gray-500'
                        }
                        ${isSelected ? 'scale-110 shadow-yellow-400/50 shadow-xl' : ''}
                      `}
                    >
                      {isKing(cell) && (
                        <span className="text-yellow-300 text-lg leading-none drop-shadow-md">♛</span>
                      )}
                    </div>
                  )}
                  {isValidTarget && !cell && (
                    <div className="w-4 h-4 rounded-full bg-green-400/70 animate-pulse" />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex gap-8 text-sm font-mono text-gray-300">
        <span>🔴 You: {countPieces(board).red}</span>
        <span>⚫ AI: {countPieces(board).black}</span>
      </div>
      <p className="text-xs text-gray-400 font-mono">Tap piece to select, tap destination to move</p>
    </div>
  );
}
