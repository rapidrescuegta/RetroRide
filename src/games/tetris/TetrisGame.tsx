'use client';

import { useRef, useEffect, useCallback } from 'react';

interface TetrisGameProps {
  onGameOver: (score: number) => void;
  level: 'easy' | 'medium' | 'hard';
}

const ROWS = 20;
const BLOCK = 24;
const COLORS = [
  '#00f0f0', // I - cyan
  '#f0f000', // O - yellow
  '#a000f0', // T - purple
  '#00f000', // S - green
  '#f00000', // Z - red
  '#0000f0', // J - blue
  '#f0a000', // L - orange
];

// Darker shade for each color (bottom-right gradient)
const COLORS_DARK = [
  '#009999',
  '#999900',
  '#600090',
  '#009900',
  '#990000',
  '#000099',
  '#996600',
];

// Lighter shade for each color (top-left gradient / shine)
const COLORS_LIGHT = [
  '#66ffff',
  '#ffff66',
  '#cc66ff',
  '#66ff66',
  '#ff6666',
  '#6666ff',
  '#ffcc66',
];

const TETROMINOES = [
  // I
  [[0,0],[1,0],[2,0],[3,0]],
  // O
  [[0,0],[1,0],[0,1],[1,1]],
  // T
  [[0,0],[1,0],[2,0],[1,1]],
  // S
  [[1,0],[2,0],[0,1],[1,1]],
  // Z
  [[0,0],[1,0],[1,1],[2,1]],
  // J
  [[0,0],[0,1],[1,1],[2,1]],
  // L
  [[2,0],[0,1],[1,1],[2,1]],
];

type Board = (number | null)[][];

// Particle system for line clear effects
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

function createBoard(cols: number): Board {
  return Array.from({ length: ROWS }, () => Array(cols).fill(null));
}

function rotatePiece(blocks: number[][]): number[][] {
  const maxX = Math.max(...blocks.map(b => b[0]));
  const maxY = Math.max(...blocks.map(b => b[1]));
  const size = Math.max(maxX, maxY);
  return blocks.map(([x, y]) => [size - y, x]);
}

export default function TetrisGame({ onGameOver, level }: TetrisGameProps) {
  // Level-based settings
  const COLS = level === 'easy' ? 12 : 10;
  const initialDropInterval = level === 'easy' ? 1200 : level === 'hard' ? 500 : 800;
  const speedIncrement = level === 'easy' ? 40 : level === 'hard' ? 100 : 75;
  const minDropInterval = level === 'easy' ? 150 : level === 'hard' ? 80 : 100;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    board: Board;
    current: { blocks: number[][]; type: number; x: number; y: number } | null;
    next: { blocks: number[][]; type: number };
    score: number;
    lines: number;
    dropInterval: number;
    lastDrop: number;
    gameOver: boolean;
    gameOverNotified: boolean;
    started: boolean;
    touchStartX: number;
    touchStartY: number;
    touchStartTime: number;
    particles: Particle[];
    lineClearFlash: number;
  }>({
    board: createBoard(COLS),
    current: null,
    next: randomPiece(),
    score: 0,
    lines: 0,
    dropInterval: initialDropInterval,
    lastDrop: 0,
    gameOver: false,
    gameOverNotified: false,
    started: false,
    touchStartX: 0,
    touchStartY: 0,
    touchStartTime: 0,
    particles: [],
    lineClearFlash: 0,
  });

  function randomPiece() {
    const type = Math.floor(Math.random() * 7);
    return { blocks: TETROMINOES[type].map(b => [...b]), type };
  }

  function spawnPiece(s: typeof stateRef.current) {
    const piece = s.next;
    const maxX = Math.max(...piece.blocks.map(b => b[0]));
    s.current = {
      blocks: piece.blocks,
      type: piece.type,
      x: Math.floor((COLS - maxX - 1) / 2),
      y: 0,
    };
    s.next = randomPiece();

    if (collides(s.board, s.current.blocks, s.current.x, s.current.y)) {
      s.gameOver = true;
      if (!s.gameOverNotified) {
        s.gameOverNotified = true;
        setTimeout(() => onGameOver(s.score), 2500);
      }
    }
  }

  function collides(board: Board, blocks: number[][], ox: number, oy: number): boolean {
    return blocks.some(([bx, by]) => {
      const nx = ox + bx;
      const ny = oy + by;
      return nx < 0 || nx >= COLS || ny >= ROWS || (ny >= 0 && board[ny][nx] !== null);
    });
  }

  function lockPiece(s: typeof stateRef.current) {
    if (!s.current) return;
    for (const [bx, by] of s.current.blocks) {
      const nx = s.current.x + bx;
      const ny = s.current.y + by;
      if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
        s.board[ny][nx] = s.current.type;
      }
    }
    clearLines(s);
    spawnPiece(s);
  }

  function spawnLineClearParticles(s: typeof stateRef.current, rowY: number) {
    for (let x = 0; x < COLS; x++) {
      const colorIdx = s.board[rowY][x];
      const color = colorIdx !== null ? COLORS[colorIdx] : '#ffffff';
      for (let i = 0; i < 4; i++) {
        s.particles.push({
          x: x * BLOCK + BLOCK / 2,
          y: rowY * BLOCK + BLOCK / 2,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 6 - 2,
          life: 1,
          maxLife: 1,
          color,
          size: 2 + Math.random() * 3,
        });
      }
    }
  }

  function clearLines(s: typeof stateRef.current) {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (s.board[y].every(c => c !== null)) {
        spawnLineClearParticles(s, y);
        s.board.splice(y, 1);
        s.board.unshift(Array(COLS).fill(null));
        cleared++;
        y++; // recheck this row
      }
    }
    if (cleared > 0) {
      s.lineClearFlash = 1;
      const points = [0, 100, 200, 400, 800];
      s.score += points[cleared] || 800;
      s.lines += cleared;
      s.dropInterval = Math.max(minDropInterval, initialDropInterval - Math.floor(s.lines / 10) * speedIncrement);
    }
  }

  const moveLeft = useCallback(() => {
    const s = stateRef.current;
    if (!s.current || s.gameOver) return;
    if (!collides(s.board, s.current.blocks, s.current.x - 1, s.current.y)) {
      s.current.x--;
    }
  }, []);

  const moveRight = useCallback(() => {
    const s = stateRef.current;
    if (!s.current || s.gameOver) return;
    if (!collides(s.board, s.current.blocks, s.current.x + 1, s.current.y)) {
      s.current.x++;
    }
  }, []);

  const softDrop = useCallback(() => {
    const s = stateRef.current;
    if (!s.current || s.gameOver) return;
    if (!collides(s.board, s.current.blocks, s.current.x, s.current.y + 1)) {
      s.current.y++;
      s.score += 1;
    } else {
      lockPiece(s);
    }
  }, []);

  const rotate = useCallback(() => {
    const s = stateRef.current;
    if (!s.current || s.gameOver) return;
    const rotated = rotatePiece(s.current.blocks);
    // Try normal rotation, then wall kicks
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(s.board, rotated, s.current.x + kick, s.current.y)) {
        s.current.blocks = rotated;
        s.current.x += kick;
        return;
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const s = stateRef.current;
    // Reset state for fresh mount
    s.board = createBoard(COLS);
    s.current = null;
    s.next = randomPiece();
    s.score = 0;
    s.lines = 0;
    s.dropInterval = initialDropInterval;
    s.lastDrop = 0;
    s.gameOver = false;
    s.started = false;
    s.particles = [];
    s.lineClearFlash = 0;

    const SIDE_W = 6 * BLOCK;
    const W = COLS * BLOCK + SIDE_W;
    const H = ROWS * BLOCK;
    canvas.width = W;
    canvas.height = H;

    function drawBlock(x: number, y: number, typeIdx: number, size: number = BLOCK, alpha: number = 1) {
      if (!ctx) return;
      const r = size * 0.15; // corner radius
      const inset = 1;
      const bx = x + inset;
      const by = y + inset;
      const bs = size - inset * 2 - 1;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Rounded rect path
      ctx.beginPath();
      ctx.moveTo(bx + r, by);
      ctx.lineTo(bx + bs - r, by);
      ctx.quadraticCurveTo(bx + bs, by, bx + bs, by + r);
      ctx.lineTo(bx + bs, by + bs - r);
      ctx.quadraticCurveTo(bx + bs, by + bs, bx + bs - r, by + bs);
      ctx.lineTo(bx + r, by + bs);
      ctx.quadraticCurveTo(bx, by + bs, bx, by + bs - r);
      ctx.lineTo(bx, by + r);
      ctx.quadraticCurveTo(bx, by, bx + r, by);
      ctx.closePath();

      // Gradient fill (lighter top-left to darker bottom-right)
      const grad = ctx.createLinearGradient(bx, by, bx + bs, by + bs);
      grad.addColorStop(0, COLORS_LIGHT[typeIdx]);
      grad.addColorStop(0.4, COLORS[typeIdx]);
      grad.addColorStop(1, COLORS_DARK[typeIdx]);
      ctx.fillStyle = grad;
      ctx.fill();

      // Glossy highlight (top-left shine)
      const shineGrad = ctx.createLinearGradient(bx, by, bx + bs * 0.5, by + bs * 0.5);
      shineGrad.addColorStop(0, 'rgba(255,255,255,0.35)');
      shineGrad.addColorStop(0.5, 'rgba(255,255,255,0.08)');
      shineGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shineGrad;
      ctx.fill();

      // Subtle border glow
      ctx.strokeStyle = COLORS[typeIdx];
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Inner highlight line (top edge)
      ctx.beginPath();
      ctx.moveTo(bx + r + 2, by + 2);
      ctx.lineTo(bx + bs - r - 2, by + 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    }

    function drawGhostBlock(x: number, y: number, typeIdx: number, size: number = BLOCK) {
      if (!ctx) return;
      const r = size * 0.15;
      const inset = 1;
      const bx = x + inset;
      const by = y + inset;
      const bs = size - inset * 2 - 1;

      ctx.save();

      // Rounded rect path
      ctx.beginPath();
      ctx.moveTo(bx + r, by);
      ctx.lineTo(bx + bs - r, by);
      ctx.quadraticCurveTo(bx + bs, by, bx + bs, by + r);
      ctx.lineTo(bx + bs, by + bs - r);
      ctx.quadraticCurveTo(bx + bs, by + bs, bx + bs - r, by + bs);
      ctx.lineTo(bx + r, by + bs);
      ctx.quadraticCurveTo(bx, by + bs, bx, by + bs - r);
      ctx.lineTo(bx, by + r);
      ctx.quadraticCurveTo(bx, by, bx + r, by);
      ctx.closePath();

      // Soft translucent fill with color
      ctx.fillStyle = COLORS[typeIdx] + '18';
      ctx.fill();

      // Glowing border
      ctx.strokeStyle = COLORS[typeIdx] + '55';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = COLORS[typeIdx];
      ctx.shadowBlur = 6;
      ctx.stroke();

      ctx.restore();
    }

    function updateParticles() {
      s.particles = s.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life -= 0.025;
        return p.life > 0;
      });
      if (s.lineClearFlash > 0) {
        s.lineClearFlash -= 0.05;
      }
    }

    function drawParticles() {
      if (!ctx) return;
      for (const p of s.particles) {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    function draw() {
      if (!ctx) return;
      // Background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#0d0d1a');
      bgGrad.addColorStop(1, '#1a1a2e');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Faint grid lines
      for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * BLOCK, 0);
        ctx.lineTo(x * BLOCK, H);
        ctx.strokeStyle = 'rgba(100,100,180,0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * BLOCK);
        ctx.lineTo(COLS * BLOCK, y * BLOCK);
        ctx.strokeStyle = 'rgba(100,100,180,0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Line clear flash overlay
      if (s.lineClearFlash > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(255,255,255,${s.lineClearFlash * 0.15})`;
        ctx.fillRect(0, 0, COLS * BLOCK, H);
        ctx.restore();
      }

      // Board blocks
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (s.board[y][x] !== null) {
            drawBlock(x * BLOCK, y * BLOCK, s.board[y][x]!);
          }
        }
      }

      // Current piece + ghost
      if (s.current) {
        // Ghost piece
        let ghostY = s.current.y;
        while (!collides(s.board, s.current.blocks, s.current.x, ghostY + 1)) {
          ghostY++;
        }
        for (const [bx, by] of s.current.blocks) {
          const gx = (s.current.x + bx) * BLOCK;
          const gy = (ghostY + by) * BLOCK;
          if (ghostY + by >= 0) {
            drawGhostBlock(gx, gy, s.current.type);
          }
        }
        // Active piece
        for (const [bx, by] of s.current.blocks) {
          const px = (s.current.x + bx) * BLOCK;
          const py = (s.current.y + by) * BLOCK;
          if (s.current.y + by >= 0) {
            drawBlock(px, py, s.current.type);
          }
        }
      }

      // Particles
      drawParticles();

      // Side panel
      const sx = COLS * BLOCK + 10;
      const panelGrad = ctx.createLinearGradient(COLS * BLOCK, 0, W, 0);
      panelGrad.addColorStop(0, '#10102a');
      panelGrad.addColorStop(1, '#161638');
      ctx.fillStyle = panelGrad;
      ctx.fillRect(COLS * BLOCK, 0, SIDE_W, H);

      // Subtle separator line
      ctx.beginPath();
      ctx.moveTo(COLS * BLOCK, 0);
      ctx.lineTo(COLS * BLOCK, H);
      ctx.strokeStyle = 'rgba(100,100,255,0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // SCORE label
      ctx.fillStyle = '#8888bb';
      ctx.font = 'bold 11px sans-serif';
      ctx.letterSpacing = '2px';
      ctx.fillText('SCORE', sx, 24);
      ctx.letterSpacing = '0px';
      // Score value with glow
      ctx.save();
      ctx.fillStyle = '#00f0f0';
      ctx.shadowColor = '#00f0f0';
      ctx.shadowBlur = 10;
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(String(s.score), sx, 50);
      ctx.restore();

      // LINES label
      ctx.fillStyle = '#8888bb';
      ctx.font = 'bold 11px sans-serif';
      ctx.letterSpacing = '2px';
      ctx.fillText('LINES', sx, 82);
      ctx.letterSpacing = '0px';
      ctx.save();
      ctx.fillStyle = '#f0a000';
      ctx.shadowColor = '#f0a000';
      ctx.shadowBlur = 10;
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(String(s.lines), sx, 108);
      ctx.restore();

      // LEVEL
      const level = Math.floor(s.lines / 10) + 1;
      ctx.fillStyle = '#8888bb';
      ctx.font = 'bold 11px sans-serif';
      ctx.letterSpacing = '2px';
      ctx.fillText('LEVEL', sx, 140);
      ctx.letterSpacing = '0px';
      ctx.save();
      ctx.fillStyle = '#a000f0';
      ctx.shadowColor = '#a000f0';
      ctx.shadowBlur = 10;
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(String(level), sx, 166);
      ctx.restore();

      // NEXT label
      ctx.fillStyle = '#8888bb';
      ctx.font = 'bold 11px sans-serif';
      ctx.letterSpacing = '2px';
      ctx.fillText('NEXT', sx, 204);
      ctx.letterSpacing = '0px';

      // Next piece preview with glow
      if (s.next) {
        const smallBlock = 16;
        const previewX = sx + 4;
        const previewY = 216;

        // Subtle glow behind the preview
        ctx.save();
        ctx.shadowColor = COLORS[s.next.type];
        ctx.shadowBlur = 15;
        ctx.fillStyle = 'rgba(0,0,0,0)';
        for (const [bx, by] of s.next.blocks) {
          ctx.fillRect(previewX + bx * smallBlock, previewY + by * smallBlock, smallBlock, smallBlock);
        }
        ctx.restore();

        for (const [bx, by] of s.next.blocks) {
          drawBlock(previewX + bx * smallBlock, previewY + by * smallBlock, s.next.type, smallBlock);
        }
      }

      // Start message
      if (!s.started && !s.gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(0, 0, COLS * BLOCK, H);
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#00f0f0';
        ctx.shadowBlur = 20;
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TAP TO START', (COLS * BLOCK) / 2, H / 2);
        ctx.restore();
        ctx.textAlign = 'left';
      }

      // Game over
      if (s.gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, COLS * BLOCK, H);

        ctx.save();
        ctx.textAlign = 'center';

        // GAME OVER text with red glow
        ctx.fillStyle = '#ff2244';
        ctx.shadowColor = '#ff0033';
        ctx.shadowBlur = 25;
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('GAME OVER', (COLS * BLOCK) / 2, H / 2 - 16);

        // Score with cyan glow
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#00f0f0';
        ctx.shadowBlur = 15;
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(`Score: ${s.score}`, (COLS * BLOCK) / 2, H / 2 + 18);

        ctx.restore();
        ctx.textAlign = 'left';
      }
    }

    let animId = 0;
    function loop(time: number) {
      if (s.started && !s.gameOver) {
        if (!s.current) {
          spawnPiece(s);
          s.lastDrop = time;
        }
        if (time - s.lastDrop > s.dropInterval) {
          if (s.current && !collides(s.board, s.current.blocks, s.current.x, s.current.y + 1)) {
            s.current.y++;
          } else if (s.current) {
            lockPiece(s);
          }
          s.lastDrop = time;
        }
      }
      updateParticles();
      draw();
      animId = requestAnimationFrame(loop);
    }
    animId = requestAnimationFrame(loop);

    function handleKey(e: KeyboardEvent) {
      if (s.gameOver) return;
      if (!s.started) {
        s.started = true;
        return;
      }
      switch (e.key) {
        case 'ArrowLeft': moveLeft(); e.preventDefault(); break;
        case 'ArrowRight': moveRight(); e.preventDefault(); break;
        case 'ArrowDown': softDrop(); e.preventDefault(); break;
        case 'ArrowUp': rotate(); e.preventDefault(); break;
      }
    }

    // Touch state tracking for continuous movement
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let touchCurrentX = 0;
    let touchCurrentY = 0;
    let touchMovedCells = 0; // how many cells moved during this drag
    let touchDropped = false; // whether soft drop was triggered this touch

    function handleTouchStart(e: TouchEvent) {
      e.preventDefault();
      if (s.gameOver) return;
      if (!s.started) {
        s.started = true;
        return;
      }
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchCurrentX = touch.clientX;
      touchCurrentY = touch.clientY;
      touchStartTime = Date.now();
      touchMovedCells = 0;
      touchDropped = false;
    }

    function handleTouchMove(e: TouchEvent) {
      e.preventDefault();
      if (!s.started || s.gameOver) return;
      const touch = e.touches[0];
      touchCurrentX = touch.clientX;
      touchCurrentY = touch.clientY;

      const dx = touchCurrentX - touchStartX;
      const dy = touchCurrentY - touchStartY;

      // Horizontal movement: move one cell per ~25px of drag
      const cellThreshold = 25;
      const targetCells = Math.round(dx / cellThreshold);
      while (touchMovedCells < targetCells) {
        moveRight();
        touchMovedCells++;
      }
      while (touchMovedCells > targetCells) {
        moveLeft();
        touchMovedCells--;
      }

      // Downward drag for soft drop (continuous)
      if (dy > 40 && !touchDropped) {
        softDrop();
        touchDropped = true;
        // Reset Y origin so continued dragging triggers more drops
        touchStartY = touchCurrentY - 20;
        touchDropped = false;
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      e.preventDefault();
      if (!s.started || s.gameOver) return;
      const dt = Date.now() - touchStartTime;
      const dx = Math.abs(touchCurrentX - touchStartX);
      const dy = Math.abs(touchCurrentY - touchStartY);

      // Tap to rotate (short touch with minimal movement)
      if (dx < 15 && dy < 15 && dt < 300) {
        rotate();
      }
    }

    window.addEventListener('keydown', handleKey);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', handleKey);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onGameOver, moveLeft, moveRight, softDrop, rotate, COLS, initialDropInterval, minDropInterval, speedIncrement]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <canvas
        ref={canvasRef}
        style={{
          maxWidth: '400px',
          width: '100%',
          height: 'auto',
          borderRadius: '12px',
          border: '2px solid rgba(100,100,255,0.2)',
          boxShadow: '0 0 30px rgba(0,100,255,0.15)',
          touchAction: 'none',
        }}
      />
    </div>
  );
}
