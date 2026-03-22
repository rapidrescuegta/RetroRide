'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

interface ChessGameProps {
  onGameOver: (score: number) => void;
  level: 'easy' | 'medium' | 'hard';
}

// Types
type Color = 'w' | 'b';
type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';
interface Piece { color: Color; type: PieceType; }
type Square = Piece | null;
type Board = Square[][];

interface Move {
  fromR: number; fromC: number;
  toR: number; toC: number;
  captured?: Piece;
  promotion?: PieceType;
  castling?: 'K' | 'Q';
  enPassant?: boolean;
}

interface GameState {
  board: Board;
  turn: Color;
  castling: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
  enPassantTarget: [number, number] | null;
  halfMoveClock: number;
  fullMoveNumber: number;
  lastMove: Move | null;
  inCheck: boolean;
}

// Unicode pieces
const PIECE_CHARS: Record<Color, Record<PieceType, string>> = {
  w: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },
  b: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' },
};

// Piece values for AI
const PIECE_VALUES: Record<PieceType, number> = {
  P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000,
};

// Position bonuses (from white's perspective, flip for black)
const PAWN_TABLE = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0],
];

const KNIGHT_TABLE = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50],
];

const BISHOP_TABLE = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10, 10,  5, 10, 10,  5, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20],
];

const KING_TABLE = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [ 20, 20,  0,  0,  0,  0, 20, 20],
  [ 20, 30, 10,  0,  0, 10, 30, 20],
];

function getPST(type: PieceType): number[][] | null {
  switch (type) {
    case 'P': return PAWN_TABLE;
    case 'N': return KNIGHT_TABLE;
    case 'B': return BISHOP_TABLE;
    case 'K': return KING_TABLE;
    default: return null;
  }
}

// Board helpers
function createInitialBoard(): Board {
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  const backRank: PieceType[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let c = 0; c < 8; c++) {
    board[0][c] = { color: 'b', type: backRank[c] };
    board[1][c] = { color: 'b', type: 'P' };
    board[6][c] = { color: 'w', type: 'P' };
    board[7][c] = { color: 'w', type: backRank[c] };
  }
  return board;
}

function cloneBoard(b: Board): Board {
  return b.map(row => row.map(sq => sq ? { ...sq } : null));
}

function cloneState(s: GameState): GameState {
  return {
    board: cloneBoard(s.board),
    turn: s.turn,
    castling: { ...s.castling },
    enPassantTarget: s.enPassantTarget ? [...s.enPassantTarget] as [number, number] : null,
    halfMoveClock: s.halfMoveClock,
    fullMoveNumber: s.fullMoveNumber,
    lastMove: s.lastMove,
    inCheck: s.inCheck,
  };
}

function findKing(board: Board, color: Color): [number, number] {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.color === color && board[r][c]?.type === 'K')
        return [r, c];
  return [-1, -1]; // should never happen
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

// Check if a square is attacked by the given color
function isAttackedBy(board: Board, r: number, c: number, byColor: Color): boolean {
  // Pawn attacks
  const pawnDir = byColor === 'w' ? -1 : 1;
  // Pawns attack from behind (relative to their direction)
  const pr = r - pawnDir;
  for (const dc of [-1, 1]) {
    const pc = c + dc;
    if (inBounds(pr, pc) && board[pr][pc]?.color === byColor && board[pr][pc]?.type === 'P')
      return true;
  }

  // Knight attacks
  const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  for (const [dr, dc] of knightMoves) {
    const nr = r + dr, nc = c + dc;
    if (inBounds(nr, nc) && board[nr][nc]?.color === byColor && board[nr][nc]?.type === 'N')
      return true;
  }

  // King attacks
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc) && board[nr][nc]?.color === byColor && board[nr][nc]?.type === 'K')
        return true;
    }

  // Sliding pieces: rook/queen on ranks/files
  const rookDirs = [[0,1],[0,-1],[1,0],[-1,0]];
  for (const [dr, dc] of rookDirs) {
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      const sq = board[nr][nc];
      if (sq) {
        if (sq.color === byColor && (sq.type === 'R' || sq.type === 'Q')) return true;
        break;
      }
      nr += dr; nc += dc;
    }
  }

  // Sliding pieces: bishop/queen on diagonals
  const bishopDirs = [[1,1],[1,-1],[-1,1],[-1,-1]];
  for (const [dr, dc] of bishopDirs) {
    let nr = r + dr, nc = c + dc;
    while (inBounds(nr, nc)) {
      const sq = board[nr][nc];
      if (sq) {
        if (sq.color === byColor && (sq.type === 'B' || sq.type === 'Q')) return true;
        break;
      }
      nr += dr; nc += dc;
    }
  }

  return false;
}

function isInCheck(board: Board, color: Color): boolean {
  const [kr, kc] = findKing(board, color);
  if (kr === -1) return false;
  const opp = color === 'w' ? 'b' : 'w';
  return isAttackedBy(board, kr, kc, opp);
}

// Generate pseudo-legal moves (before check filtering)
function generatePseudoMoves(state: GameState, color: Color): Move[] {
  const { board, enPassantTarget, castling } = state;
  const moves: Move[] = [];
  const opp = color === 'w' ? 'b' : 'w';

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== color) continue;

      const addMove = (toR: number, toC: number, extra?: Partial<Move>) => {
        const captured = board[toR][toC] || undefined;
        moves.push({ fromR: r, fromC: c, toR, toC, captured, ...extra });
      };

      const addIfValid = (toR: number, toC: number) => {
        if (!inBounds(toR, toC)) return false;
        const target = board[toR][toC];
        if (target && target.color === color) return false;
        addMove(toR, toC);
        return !target; // return true if square was empty (for sliding)
      };

      switch (piece.type) {
        case 'P': {
          const dir = color === 'w' ? -1 : 1;
          const startRow = color === 'w' ? 6 : 1;
          const promoRow = color === 'w' ? 0 : 7;

          // Forward
          const fwdR = r + dir;
          if (inBounds(fwdR, c) && !board[fwdR][c]) {
            if (fwdR === promoRow) {
              addMove(fwdR, c, { promotion: 'Q' });
            } else {
              addMove(fwdR, c);
              // Double push
              if (r === startRow) {
                const fwd2 = r + 2 * dir;
                if (!board[fwd2][c]) addMove(fwd2, c);
              }
            }
          }

          // Captures
          for (const dc of [-1, 1]) {
            const nc = c + dc;
            if (!inBounds(fwdR, nc)) continue;
            const target = board[fwdR][nc];
            if (target && target.color === opp) {
              if (fwdR === promoRow) {
                addMove(fwdR, nc, { promotion: 'Q' });
              } else {
                addMove(fwdR, nc);
              }
            }
            // En passant
            if (enPassantTarget && enPassantTarget[0] === fwdR && enPassantTarget[1] === nc) {
              moves.push({
                fromR: r, fromC: c, toR: fwdR, toC: nc,
                captured: board[r][nc]!, enPassant: true,
              });
            }
          }
          break;
        }

        case 'N':
          for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])
            addIfValid(r + dr, c + dc);
          break;

        case 'B':
          for (const [dr, dc] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
            let nr = r + dr, nc = c + dc;
            while (inBounds(nr, nc)) {
              if (!addIfValid(nr, nc)) break;
              nr += dr; nc += dc;
            }
          }
          break;

        case 'R':
          for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
            let nr = r + dr, nc = c + dc;
            while (inBounds(nr, nc)) {
              if (!addIfValid(nr, nc)) break;
              nr += dr; nc += dc;
            }
          }
          break;

        case 'Q':
          for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]) {
            let nr = r + dr, nc = c + dc;
            while (inBounds(nr, nc)) {
              if (!addIfValid(nr, nc)) break;
              nr += dr; nc += dc;
            }
          }
          break;

        case 'K': {
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              addIfValid(r + dr, c + dc);
            }

          // Castling
          const row = color === 'w' ? 7 : 0;
          if (r === row && c === 4) {
            // Kingside
            const canK = color === 'w' ? castling.wK : castling.bK;
            if (canK && !board[row][5] && !board[row][6] && board[row][7]?.type === 'R' && board[row][7]?.color === color) {
              if (!isAttackedBy(board, row, 4, opp) && !isAttackedBy(board, row, 5, opp) && !isAttackedBy(board, row, 6, opp)) {
                moves.push({ fromR: row, fromC: 4, toR: row, toC: 6, castling: 'K' });
              }
            }
            // Queenside
            const canQ = color === 'w' ? castling.wQ : castling.bQ;
            if (canQ && !board[row][1] && !board[row][2] && !board[row][3] && board[row][0]?.type === 'R' && board[row][0]?.color === color) {
              if (!isAttackedBy(board, row, 4, opp) && !isAttackedBy(board, row, 3, opp) && !isAttackedBy(board, row, 2, opp)) {
                moves.push({ fromR: row, fromC: 4, toR: row, toC: 2, castling: 'Q' });
              }
            }
          }
          break;
        }
      }
    }
  }

  return moves;
}

// Apply a move to state, returns new state
function applyMove(state: GameState, move: Move): GameState {
  const ns = cloneState(state);
  const { board } = ns;
  const piece = board[move.fromR][move.fromC]!;

  // Move the piece
  board[move.toR][move.toC] = piece;
  board[move.fromR][move.fromC] = null;

  // En passant capture
  if (move.enPassant) {
    board[move.fromR][move.toC] = null;
  }

  // Promotion
  if (move.promotion) {
    board[move.toR][move.toC] = { color: piece.color, type: move.promotion };
  }

  // Castling - move rook
  if (move.castling) {
    const row = move.toR;
    if (move.castling === 'K') {
      board[row][5] = board[row][7];
      board[row][7] = null;
    } else {
      board[row][3] = board[row][0];
      board[row][0] = null;
    }
  }

  // Update castling rights
  if (piece.type === 'K') {
    if (piece.color === 'w') { ns.castling.wK = false; ns.castling.wQ = false; }
    else { ns.castling.bK = false; ns.castling.bQ = false; }
  }
  if (piece.type === 'R') {
    if (move.fromR === 7 && move.fromC === 0) ns.castling.wQ = false;
    if (move.fromR === 7 && move.fromC === 7) ns.castling.wK = false;
    if (move.fromR === 0 && move.fromC === 0) ns.castling.bQ = false;
    if (move.fromR === 0 && move.fromC === 7) ns.castling.bK = false;
  }
  // If rook captured
  if (move.toR === 7 && move.toC === 0) ns.castling.wQ = false;
  if (move.toR === 7 && move.toC === 7) ns.castling.wK = false;
  if (move.toR === 0 && move.toC === 0) ns.castling.bQ = false;
  if (move.toR === 0 && move.toC === 7) ns.castling.bK = false;

  // En passant target
  if (piece.type === 'P' && Math.abs(move.toR - move.fromR) === 2) {
    ns.enPassantTarget = [(move.fromR + move.toR) / 2, move.fromC];
  } else {
    ns.enPassantTarget = null;
  }

  // Half-move clock
  if (piece.type === 'P' || move.captured) {
    ns.halfMoveClock = 0;
  } else {
    ns.halfMoveClock++;
  }

  // Full move number
  if (state.turn === 'b') ns.fullMoveNumber++;

  ns.turn = state.turn === 'w' ? 'b' : 'w';
  ns.lastMove = move;
  ns.inCheck = isInCheck(ns.board, ns.turn);

  return ns;
}

// Generate legal moves
function getLegalMoves(state: GameState, color: Color): Move[] {
  const pseudo = generatePseudoMoves(state, color);
  return pseudo.filter(move => {
    const ns = applyMove(state, move);
    // After our move, our king must not be in check
    return !isInCheck(ns.board, color);
  });
}

// Game status
type GameStatus = 'playing' | 'checkmate' | 'stalemate' | 'draw50' | 'insufficient';

function getGameStatus(state: GameState): GameStatus {
  const legal = getLegalMoves(state, state.turn);
  if (legal.length === 0) {
    return state.inCheck ? 'checkmate' : 'stalemate';
  }
  if (state.halfMoveClock >= 100) return 'draw50';

  // Insufficient material
  const pieces: Piece[] = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (state.board[r][c]) pieces.push(state.board[r][c]!);

  if (pieces.length === 2) return 'insufficient'; // K vs K
  if (pieces.length === 3) {
    const nonKing = pieces.find(p => p.type !== 'K');
    if (nonKing && (nonKing.type === 'B' || nonKing.type === 'N')) return 'insufficient';
  }

  return 'playing';
}

// AI: evaluation
function evaluate(state: GameState): number {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = state.board[r][c];
      if (!piece) continue;
      const sign = piece.color === 'w' ? 1 : -1;
      score += sign * PIECE_VALUES[piece.type];

      // Position table
      const table = getPST(piece.type);
      if (table) {
        const tr = piece.color === 'w' ? r : 7 - r;
        score += sign * table[tr][c];
      }
    }
  }

  // Mobility bonus
  const wMoves = generatePseudoMoves(state, 'w').length;
  const bMoves = generatePseudoMoves(state, 'b').length;
  score += (wMoves - bMoves) * 3;

  return score;
}

// AI: minimax with alpha-beta
function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
): number {
  const status = getGameStatus(state);
  if (status === 'checkmate') return maximizing ? -99999 + (3 - depth) : 99999 - (3 - depth);
  if (status === 'stalemate' || status === 'draw50' || status === 'insufficient') return 0;
  if (depth === 0) return evaluate(state);

  const moves = getLegalMoves(state, state.turn);

  // Move ordering: captures first, then checks
  moves.sort((a, b) => {
    const aVal = (a.captured ? PIECE_VALUES[a.captured.type] : 0) + (a.promotion ? 800 : 0);
    const bVal = (b.captured ? PIECE_VALUES[b.captured.type] : 0) + (b.promotion ? 800 : 0);
    return bVal - aVal;
  });

  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      const ns = applyMove(state, move);
      const val = minimax(ns, depth - 1, alpha, beta, false);
      best = Math.max(best, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      const ns = applyMove(state, move);
      const val = minimax(ns, depth - 1, alpha, beta, true);
      best = Math.min(best, val);
      beta = Math.min(beta, val);
      if (beta <= alpha) break;
    }
    return best;
  }
}

function findBestMove(state: GameState, depth: number = 2, randomChance: number = 0.15): Move | null {
  const moves = getLegalMoves(state, state.turn);
  if (moves.length === 0) return null;

  // Random move chance (for easier difficulty)
  if (randomChance > 0 && Math.random() < randomChance) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const isMaximizing = state.turn === 'w';
  let bestMove = moves[0];
  let bestVal = isMaximizing ? -Infinity : Infinity;

  // Use provided depth, but boost by 1 for endgame
  const totalPieces = state.board.flat().filter(Boolean).length;
  const searchDepth = totalPieces <= 12 ? depth + 1 : depth;

  for (const move of moves) {
    const ns = applyMove(state, move);
    const val = minimax(ns, searchDepth - 1, -Infinity, Infinity, isMaximizing ? false : true);

    if (isMaximizing ? val > bestVal : val < bestVal) {
      bestVal = val;
      bestMove = move;
    }
  }

  return bestMove;
}

// Column labels
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export default function ChessGame({ onGameOver, level }: ChessGameProps) {
  // Level-based AI settings
  const aiDepth = level === 'easy' ? 1 : level === 'hard' ? 3 : 2;
  const randomMoveChance = level === 'easy' ? 0.4 : level === 'hard' ? 0 : 0.15;
  const [gameState, setGameState] = useState<GameState>(() => ({
    board: createInitialBoard(),
    turn: 'w',
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    enPassantTarget: null,
    halfMoveClock: 0,
    fullMoveNumber: 1,
    lastMove: null,
    inCheck: false,
  }));

  const [selectedSquare, setSelectedSquare] = useState<[number, number] | null>(null);
  const [validMoves, setValidMoves] = useState<Move[]>([]);
  const [status, setStatus] = useState<GameStatus>('playing');
  const [capturedByWhite, setCapturedByWhite] = useState<Piece[]>([]); // pieces white captured (black pieces)
  const [capturedByBlack, setCapturedByBlack] = useState<Piece[]>([]); // pieces black captured (white pieces)
  const [moveCount, setMoveCount] = useState(0);
  const [aiThinking, setAiThinking] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const gameOverCalled = useRef(false);

  // Check game status after each state change
  useEffect(() => {
    const s = getGameStatus(gameState);
    setStatus(s);

    if (s !== 'playing' && !gameOverCalled.current) {
      gameOverCalled.current = true;
      setGameOver(true);

      let score = 50; // draw by default
      if (s === 'checkmate') {
        // The player whose turn it is has been checkmated
        score = gameState.turn === 'b' ? 100 : 0; // if black's turn and checkmate, white wins
      }

      setTimeout(() => onGameOver(score), 2000);
    }
  }, [gameState, onGameOver]);

  // AI move
  useEffect(() => {
    if (gameState.turn !== 'b' || status !== 'playing' || gameOver) return;

    setAiThinking(true);

    const timer = setTimeout(() => {
      const move = findBestMove(gameState, aiDepth, randomMoveChance);
      if (move) {
        const ns = applyMove(gameState, move);
        if (move.captured) {
          setCapturedByBlack(prev => [...prev, move.captured!]);
        }
        setMoveCount(prev => prev + 1);
        setGameState(ns);
        setSelectedSquare(null);
        setValidMoves([]);
      }
      setAiThinking(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [gameState, status, gameOver]);

  const handleSquareClick = useCallback((r: number, c: number) => {
    if (gameState.turn !== 'w' || status !== 'playing' || aiThinking) return;

    const piece = gameState.board[r][c];

    // If we have a selected piece, check if this is a valid destination
    if (selectedSquare) {
      const move = validMoves.find(m => m.toR === r && m.toC === c);
      if (move) {
        const ns = applyMove(gameState, move);
        if (move.captured) {
          setCapturedByWhite(prev => [...prev, move.captured!]);
        }
        setMoveCount(prev => prev + 1);
        setGameState(ns);
        setSelectedSquare(null);
        setValidMoves([]);
        return;
      }

      // Clicked on own piece - reselect
      if (piece && piece.color === 'w') {
        setSelectedSquare([r, c]);
        setValidMoves(getLegalMoves(gameState, 'w').filter(m => m.fromR === r && m.fromC === c));
        return;
      }

      // Clicked elsewhere - deselect
      setSelectedSquare(null);
      setValidMoves([]);
      return;
    }

    // Select a white piece
    if (piece && piece.color === 'w') {
      setSelectedSquare([r, c]);
      setValidMoves(getLegalMoves(gameState, 'w').filter(m => m.fromR === r && m.fromC === c));
    }
  }, [gameState, selectedSquare, validMoves, status, aiThinking]);

  // Helpers for rendering
  const isSelected = (r: number, c: number) => selectedSquare?.[0] === r && selectedSquare?.[1] === c;
  const isValidTarget = (r: number, c: number) => validMoves.some(m => m.toR === r && m.toC === c);
  const isCapture = (r: number, c: number) => validMoves.some(m => m.toR === r && m.toC === c && (m.captured || m.enPassant));
  const isLastMoveSquare = (r: number, c: number) => {
    if (!gameState.lastMove) return false;
    const lm = gameState.lastMove;
    return (r === lm.fromR && c === lm.fromC) || (r === lm.toR && c === lm.toC);
  };
  const isKingInCheck = (r: number, c: number) => {
    const piece = gameState.board[r][c];
    return gameState.inCheck && piece?.type === 'K' && piece?.color === gameState.turn;
  };

  const isDark = (r: number, c: number) => (r + c) % 2 === 1;

  const pieceOrder: PieceType[] = ['Q', 'R', 'B', 'N', 'P'];

  const renderCaptured = (pieces: Piece[]) => {
    const sorted = [...pieces].sort((a, b) => pieceOrder.indexOf(a.type) - pieceOrder.indexOf(b.type));
    return sorted.map((p, i) => (
      <span
        key={i}
        className={`text-lg leading-none ${
          p.color === 'w' ? 'text-gray-300 drop-shadow-[0_0_2px_rgba(255,255,255,0.5)]' : 'text-gray-600 drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]'
        }`}
      >
        {PIECE_CHARS[p.color][p.type]}
      </span>
    ));
  };

  const statusText = () => {
    if (status === 'checkmate') {
      return gameState.turn === 'b' ? 'Checkmate! You win!' : 'Checkmate! You lose.';
    }
    if (status === 'stalemate') return 'Stalemate - Draw!';
    if (status === 'draw50') return 'Draw by 50-move rule!';
    if (status === 'insufficient') return 'Draw - Insufficient material!';
    if (aiThinking) return 'AI is thinking...';
    if (gameState.inCheck) return 'Check!';
    if (gameState.turn === 'w') return 'Your turn (White)';
    return 'Black to move';
  };

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      {/* Status bar */}
      <div className="flex items-center justify-between w-full max-w-[400px] px-1">
        <div className={`text-sm font-semibold tracking-wide ${
          status === 'checkmate' && gameState.turn === 'b' ? 'text-emerald-400' :
          status === 'checkmate' && gameState.turn === 'w' ? 'text-red-400' :
          status !== 'playing' ? 'text-amber-400' :
          gameState.inCheck ? 'text-red-400' :
          'text-slate-300'
        }`}>
          {statusText()}
        </div>
        <div className="text-xs text-slate-500 font-mono">
          Move {moveCount}
        </div>
      </div>

      {/* Captured by black (white pieces taken) - shown at top */}
      <div className="flex items-center gap-0.5 min-h-[24px] px-1 w-full max-w-[400px]">
        {renderCaptured(capturedByBlack)}
      </div>

      {/* Board */}
      <div className="relative">
        {/* Board border glow */}
        <div className="absolute -inset-1 rounded-lg bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-cyan-500/20 blur-sm" />

        <div className="relative grid grid-cols-8 rounded-md overflow-hidden border border-slate-700/50 shadow-2xl shadow-indigo-950/50">
          {Array.from({ length: 64 }).map((_, idx) => {
            const r = Math.floor(idx / 8);
            const c = idx % 8;
            const piece = gameState.board[r][c];
            const dark = isDark(r, c);
            const selected = isSelected(r, c);
            const validTarget = isValidTarget(r, c);
            const capture = isCapture(r, c);
            const lastMove = isLastMoveSquare(r, c);
            const kingCheck = isKingInCheck(r, c);

            return (
              <div
                key={idx}
                onClick={() => handleSquareClick(r, c)}
                className={`
                  relative w-[48px] h-[48px] sm:w-[56px] sm:h-[56px] flex items-center justify-center
                  cursor-pointer transition-all duration-150
                  ${dark
                    ? 'bg-indigo-950/80'
                    : 'bg-slate-600/40'
                  }
                  ${selected ? 'ring-2 ring-inset ring-cyan-400 shadow-[inset_0_0_16px_rgba(34,211,238,0.3)]' : ''}
                  ${lastMove && !selected ? (dark ? 'bg-indigo-800/60' : 'bg-slate-500/50') : ''}
                  ${kingCheck ? 'shadow-[inset_0_0_20px_rgba(239,68,68,0.6)] ring-2 ring-inset ring-red-500/70' : ''}
                  hover:brightness-125
                `}
              >
                {/* Coordinate labels */}
                {c === 0 && (
                  <span className="absolute top-0.5 left-0.5 text-[9px] font-mono text-slate-500/60 leading-none">
                    {RANKS[r]}
                  </span>
                )}
                {r === 7 && (
                  <span className="absolute bottom-0.5 right-1 text-[9px] font-mono text-slate-500/60 leading-none">
                    {FILES[c]}
                  </span>
                )}

                {/* Valid move indicator */}
                {validTarget && !capture && !piece && (
                  <div className="absolute w-3 h-3 rounded-full bg-cyan-400/40 shadow-[0_0_8px_rgba(34,211,238,0.4)]" />
                )}

                {/* Capture ring */}
                {(capture || (validTarget && piece)) && (
                  <div className="absolute inset-1 rounded-full border-2 border-cyan-400/50 shadow-[0_0_10px_rgba(34,211,238,0.3)]" />
                )}

                {/* Piece */}
                {piece && (
                  <span
                    className={`
                      relative z-10 text-[32px] sm:text-[38px] leading-none
                      transition-all duration-200
                      ${piece.color === 'w'
                        ? 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] [text-shadow:0_0_8px_rgba(255,255,255,0.3)]'
                        : 'text-slate-900 drop-shadow-[0_0_4px_rgba(100,100,200,0.4)] [text-shadow:0_0_6px_rgba(99,102,241,0.3)]'
                      }
                      ${selected ? 'scale-110' : ''}
                    `}
                  >
                    {PIECE_CHARS[piece.color][piece.type]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Captured by white (black pieces taken) - shown at bottom */}
      <div className="flex items-center gap-0.5 min-h-[24px] px-1 w-full max-w-[400px]">
        {renderCaptured(capturedByWhite)}
      </div>

      {/* AI thinking indicator */}
      {aiThinking && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0ms]" />
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:150ms]" />
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:300ms]" />
          </div>
          Thinking...
        </div>
      )}
    </div>
  );
}
