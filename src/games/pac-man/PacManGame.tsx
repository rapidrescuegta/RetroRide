'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface PacManGameProps {
  onGameOver: (score: number) => void;
  level: 'easy' | 'medium' | 'hard';
}

// Maze layout: 0=empty, 1=wall, 2=dot, 3=power pellet, 4=empty path
const MAZE_TEMPLATE = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,3,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,3,1],
  [1,2,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,2,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,2,1],
  [1,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,1],
  [1,1,1,1,2,1,1,1,4,1,4,1,1,1,2,1,1,1,1],
  [4,4,4,1,2,1,4,4,4,4,4,4,4,1,2,1,4,4,4],
  [1,1,1,1,2,1,4,1,1,4,1,1,4,1,2,1,1,1,1],
  [4,4,4,4,2,4,4,1,4,4,4,1,4,4,2,4,4,4,4],
  [1,1,1,1,2,1,4,1,1,1,1,1,4,1,2,1,1,1,1],
  [4,4,4,1,2,1,4,4,4,4,4,4,4,1,2,1,4,4,4],
  [1,1,1,1,2,1,4,1,1,1,1,1,4,1,2,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,2,1],
  [1,3,2,1,2,2,2,2,2,4,2,2,2,2,2,1,2,3,1],
  [1,1,2,1,2,1,2,1,1,1,1,1,2,1,2,1,2,1,1],
  [1,2,2,2,2,1,2,2,2,1,2,2,2,1,2,2,2,2,1],
  [1,2,1,1,1,1,1,1,2,1,2,1,1,1,1,1,1,2,1],
  [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

const COLS = 19;
const ROWS = 21;

type Direction = 'up' | 'down' | 'left' | 'right' | 'none';

interface Ghost {
  x: number;
  y: number;
  color: string;
  dir: Direction;
  scared: boolean;
  mode: 'chase' | 'random' | 'patrol';
  patrolAxis: 'x' | 'y';
  homeX: number;
  homeY: number;
  eaten: boolean;
}

export default function PacManGame({ onGameOver, level }: PacManGameProps) {
  // Difficulty settings
  const EXTRA_LIFE_INTERVAL = 5000;
  const MAX_LIVES = 5;
  const difficultyConfig = {
    easy:   { ghostCount: 2, ghostMoveInterval: 320, powerDuration: 600, startLives: 3 },
    medium: { ghostCount: 3, ghostMoveInterval: 220, powerDuration: 350, startLives: 3 },
    hard:   { ghostCount: 4, ghostMoveInterval: 150, powerDuration: 200, startLives: 3 },
  }[level];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<{
    maze: number[][];
    pacX: number;
    pacY: number;
    pacDir: Direction;
    nextDir: Direction;
    mouthOpen: number;
    mouthDir: number;
    ghosts: Ghost[];
    score: number;
    lives: number;
    powerTimer: number;
    gameOver: boolean;
    levelComplete: boolean;
    totalDots: number;
    dotsEaten: number;
    moveTimer: number;
    ghostMoveTimer: number;
    frameCount: number;
    started: boolean;
    readyTimer: number;
    nextExtraLife: number;
    extraLifeFlash: number;
    deathFlash: number;
    invincibleUntil: number;
  } | null>(null);
  const animFrameRef = useRef<number>(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [gameOverCalled, setGameOverCalled] = useState(false);
  const finalScoreRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const initGame = useCallback(() => {
    const maze = MAZE_TEMPLATE.map(row => [...row]);
    let totalDots = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (maze[r][c] === 2 || maze[r][c] === 3) totalDots++;
      }
    }

    const allGhosts: Ghost[] = [
      { x: 8, y: 9, color: '#FF0000', dir: 'left', scared: false, mode: 'chase', patrolAxis: 'x', homeX: 1, homeY: 1, eaten: false },
      { x: 9, y: 9, color: '#FFB8FF', dir: 'up', scared: false, mode: 'random', patrolAxis: 'y', homeX: 17, homeY: 1, eaten: false },
      { x: 10, y: 9, color: '#00FFFF', dir: 'right', scared: false, mode: 'patrol', patrolAxis: 'x', homeX: 1, homeY: 19, eaten: false },
      { x: 9, y: 8, color: '#FFB852', dir: 'down', scared: false, mode: 'random', patrolAxis: 'y', homeX: 17, homeY: 19, eaten: false },
    ];
    const ghosts = allGhosts.slice(0, difficultyConfig.ghostCount);

    gameStateRef.current = {
      maze,
      pacX: 9,
      pacY: 15,
      pacDir: 'none',
      nextDir: 'none',
      mouthOpen: 0,
      mouthDir: 1,
      ghosts,
      score: 0,
      lives: difficultyConfig.startLives,
      powerTimer: 0,
      gameOver: false,
      levelComplete: false,
      totalDots,
      dotsEaten: 0,
      moveTimer: 0,
      ghostMoveTimer: 0,
      frameCount: 0,
      started: false,
      readyTimer: 90,
      nextExtraLife: EXTRA_LIFE_INTERVAL,
      extraLifeFlash: 0,
      deathFlash: 0,
      invincibleUntil: 0,
    };
    setScore(0);
    setLives(difficultyConfig.startLives);
    setGameOver(false);
    setGameOverCalled(false);
  }, []);

  const canMove = useCallback((maze: number[][], x: number, y: number, dir: Direction): boolean => {
    let nx = x, ny = y;
    if (dir === 'left') nx--;
    if (dir === 'right') nx++;
    if (dir === 'up') ny--;
    if (dir === 'down') ny++;

    // Tunnel wrap
    if (nx < 0) nx = COLS - 1;
    if (nx >= COLS) nx = 0;
    if (ny < 0 || ny >= ROWS) return false;

    return maze[ny][nx] !== 1;
  }, []);

  const getNextPos = useCallback((x: number, y: number, dir: Direction): [number, number] => {
    let nx = x, ny = y;
    if (dir === 'left') nx--;
    if (dir === 'right') nx++;
    if (dir === 'up') ny--;
    if (dir === 'down') ny++;
    if (nx < 0) nx = COLS - 1;
    if (nx >= COLS) nx = 0;
    return [nx, ny];
  }, []);

  const resetPositions = useCallback(() => {
    const gs = gameStateRef.current;
    if (!gs) return;
    gs.pacX = 9;
    gs.pacY = 15;
    gs.pacDir = 'none';
    gs.nextDir = 'none';
    const ghostStartPositions = [
      { x: 8, y: 9, dir: 'left' as Direction },
      { x: 9, y: 9, dir: 'up' as Direction },
      { x: 10, y: 9, dir: 'right' as Direction },
      { x: 9, y: 8, dir: 'down' as Direction },
    ];
    gs.ghosts.forEach((g, i) => {
      if (i < ghostStartPositions.length) {
        g.x = ghostStartPositions[i].x;
        g.y = ghostStartPositions[i].y;
        g.dir = ghostStartPositions[i].dir;
      }
    });
    gs.ghosts.forEach(g => { g.scared = false; g.eaten = false; });
    gs.powerTimer = 0;
    gs.readyTimer = 60;
    gs.started = false;
  }, []);

  const startNextLevel = useCallback(() => {
    const gs = gameStateRef.current;
    if (!gs) return;
    const maze = MAZE_TEMPLATE.map(row => [...row]);
    let totalDots = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (maze[r][c] === 2 || maze[r][c] === 3) totalDots++;
      }
    }
    gs.maze = maze;
    gs.totalDots = totalDots;
    gs.dotsEaten = 0;
    gs.levelComplete = false;
    resetPositions();
  }, [resetPositions]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  // Input handling
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const gs = gameStateRef.current;
      if (!gs || gs.gameOver) return;
      gs.started = true;
      if (e.key === 'ArrowLeft' || e.key === 'a') { gs.nextDir = 'left'; e.preventDefault(); }
      if (e.key === 'ArrowRight' || e.key === 'd') { gs.nextDir = 'right'; e.preventDefault(); }
      if (e.key === 'ArrowUp' || e.key === 'w') { gs.nextDir = 'up'; e.preventDefault(); }
      if (e.key === 'ArrowDown' || e.key === 's') { gs.nextDir = 'down'; e.preventDefault(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Touch handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const gs = gameStateRef.current;
      if (!gs || gs.gameOver) return;
      gs.started = true;

      if (Math.abs(dx) > Math.abs(dy)) {
        gs.nextDir = dx > 0 ? 'right' : 'left';
      } else {
        gs.nextDir = dy > 0 ? 'down' : 'up';
      }
      touchStartRef.current = null;
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const CELL = canvas.width / COLS;

    // Helper to lighten/darken a hex color
    const lightenColor = (hex: string, amt: number): string => {
      const num = parseInt(hex.replace('#', ''), 16);
      const r = Math.min(255, ((num >> 16) & 0xff) + amt);
      const g = Math.min(255, ((num >> 8) & 0xff) + amt);
      const b = Math.min(255, (num & 0xff) + amt);
      return `rgb(${r},${g},${b})`;
    };
    const darkenColor = (hex: string, amt: number): string => lightenColor(hex, -amt);

    let wallGlowPhase = 0;

    const drawMaze = (maze: number[][], frameCount: number) => {
      wallGlowPhase = Math.sin(frameCount * 0.03) * 0.15 + 0.85;

      // Dark background with subtle radial gradient
      const bgGrad = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 50, canvas.width / 2, canvas.height / 2, canvas.width);
      bgGrad.addColorStop(0, '#0a0a1e');
      bgGrad.addColorStop(1, '#000005');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = c * CELL;
          const y = r * CELL;
          if (maze[r][c] === 1) {
            // Neon wall glow outline effect
            // Check adjacency to draw only borders facing empty space
            const isWall = (rr: number, cc: number) => rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && maze[rr][cc] === 1;

            // Dark fill
            ctx.fillStyle = '#060620';
            ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);

            // Neon border on edges adjacent to non-wall
            const glowAlpha = wallGlowPhase;
            ctx.strokeStyle = `rgba(0, 120, 255, ${glowAlpha})`;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = '#0088ff';
            ctx.shadowBlur = 6;

            if (!isWall(r - 1, c)) { ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + CELL - 1, y + 1); ctx.stroke(); }
            if (!isWall(r + 1, c)) { ctx.beginPath(); ctx.moveTo(x + 1, y + CELL - 1); ctx.lineTo(x + CELL - 1, y + CELL - 1); ctx.stroke(); }
            if (!isWall(r, c - 1)) { ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + 1, y + CELL - 1); ctx.stroke(); }
            if (!isWall(r, c + 1)) { ctx.beginPath(); ctx.moveTo(x + CELL - 1, y + 1); ctx.lineTo(x + CELL - 1, y + CELL - 1); ctx.stroke(); }
            ctx.shadowBlur = 0;
          }
          if (maze[r][c] === 2) {
            // Small glowing orb dot
            const dotGrad = ctx.createRadialGradient(x + CELL / 2, y + CELL / 2, 0, x + CELL / 2, y + CELL / 2, 3);
            dotGrad.addColorStop(0, '#ffe8e0');
            dotGrad.addColorStop(0.6, '#ffaa88');
            dotGrad.addColorStop(1, 'rgba(255,140,100,0)');
            ctx.fillStyle = dotGrad;
            ctx.beginPath();
            ctx.arc(x + CELL / 2, y + CELL / 2, 3, 0, Math.PI * 2);
            ctx.fill();
          }
          if (maze[r][c] === 3) {
            // Pulsing power pellet with halo
            const pulse = Math.sin(frameCount * 0.12) * 0.3 + 0.7;
            const pelletR = 5 + pulse * 2;

            // Outer halo
            ctx.shadowColor = '#ffcc88';
            ctx.shadowBlur = 12;
            const haloGrad = ctx.createRadialGradient(x + CELL / 2, y + CELL / 2, 0, x + CELL / 2, y + CELL / 2, pelletR + 4);
            haloGrad.addColorStop(0, `rgba(255,220,180,${0.9 * pulse})`);
            haloGrad.addColorStop(0.5, `rgba(255,180,120,${0.4 * pulse})`);
            haloGrad.addColorStop(1, 'rgba(255,140,80,0)');
            ctx.fillStyle = haloGrad;
            ctx.beginPath();
            ctx.arc(x + CELL / 2, y + CELL / 2, pelletR + 4, 0, Math.PI * 2);
            ctx.fill();

            // Core pellet
            const coreGrad = ctx.createRadialGradient(x + CELL / 2 - 1, y + CELL / 2 - 1, 0, x + CELL / 2, y + CELL / 2, pelletR);
            coreGrad.addColorStop(0, '#fff');
            coreGrad.addColorStop(0.5, '#ffd0a0');
            coreGrad.addColorStop(1, '#ff8844');
            ctx.fillStyle = coreGrad;
            ctx.beginPath();
            ctx.arc(x + CELL / 2, y + CELL / 2, pelletR, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      }
    };

    const drawPacMan = (x: number, y: number, dir: Direction, mouthOpen: number) => {
      const cx = x * CELL + CELL / 2;
      const cy = y * CELL + CELL / 2;
      const r = CELL / 2 - 1;
      const mouthAngle = mouthOpen * 0.4;

      let startAngle = mouthAngle;
      let endAngle = Math.PI * 2 - mouthAngle;

      if (dir === 'right') { startAngle += 0; endAngle += 0; }
      else if (dir === 'down') { startAngle += Math.PI / 2; endAngle += Math.PI / 2; }
      else if (dir === 'left') { startAngle += Math.PI; endAngle += Math.PI; }
      else if (dir === 'up') { startAngle += Math.PI * 1.5; endAngle += Math.PI * 1.5; }

      // Glow
      ctx.shadowColor = '#ffee00';
      ctx.shadowBlur = 12;

      // Gradient body
      const pacGrad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy, r);
      pacGrad.addColorStop(0, '#ffffaa');
      pacGrad.addColorStop(0.4, '#ffee00');
      pacGrad.addColorStop(1, '#ddaa00');
      ctx.fillStyle = pacGrad;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fill();

      // Shine highlight
      ctx.shadowBlur = 0;
      const shineGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx - r * 0.3, cy - r * 0.3, r * 0.5);
      shineGrad.addColorStop(0, 'rgba(255,255,255,0.5)');
      shineGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shineGrad;
      ctx.beginPath();
      ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawGhost = (ghost: Ghost, frameCount: number) => {
      const cx = ghost.x * CELL + CELL / 2;
      const cy = ghost.y * CELL + CELL / 2;
      const r = CELL / 2 - 1;

      if (ghost.eaten) {
        // Just floating eyes
        const eyeR = 3.5;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx - 4, cy - 2, eyeR, 0, Math.PI * 2);
        ctx.arc(cx + 4, cy - 2, eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2244cc';
        ctx.beginPath();
        ctx.arc(cx - 4, cy - 2, 2, 0, Math.PI * 2);
        ctx.arc(cx + 4, cy - 2, 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      // Animated wavy bottom
      const waveOffset = frameCount * 0.15;

      // Glow for scared ghosts
      if (ghost.scared) {
        ctx.shadowColor = '#4444ff';
        ctx.shadowBlur = 14;
      } else {
        ctx.shadowColor = ghost.color;
        ctx.shadowBlur = 8;
      }

      // Body gradient
      const baseColor = ghost.scared ? '#2244cc' : ghost.color;
      const bodyGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      bodyGrad.addColorStop(0, lightenColor(baseColor, 60));
      bodyGrad.addColorStop(0.5, baseColor);
      bodyGrad.addColorStop(1, darkenColor(baseColor, 40));

      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(cx, cy - 2, r, Math.PI, 0);
      ctx.lineTo(cx + r, cy + r - 2);
      // Smooth wavy bottom with animation
      const segments = 4;
      for (let i = 0; i < segments; i++) {
        const x1 = cx + r - (i * 2 * r / segments);
        const x2 = cx + r - ((i + 1) * 2 * r / segments);
        const midX = (x1 + x2) / 2;
        const waveY = Math.sin(waveOffset + i * Math.PI) * 3;
        ctx.quadraticCurveTo(midX, cy + r - 2 + waveY, x2, cy + r - 2);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Body shine
      const shineGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.4, 0, cx, cy, r);
      shineGrad.addColorStop(0, 'rgba(255,255,255,0.25)');
      shineGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shineGrad;
      ctx.beginPath();
      ctx.arc(cx, cy - 2, r, Math.PI, 0);
      ctx.lineTo(cx + r, cy + r - 2);
      for (let i = 0; i < segments; i++) {
        const x1 = cx + r - (i * 2 * r / segments);
        const x2 = cx + r - ((i + 1) * 2 * r / segments);
        const midX = (x1 + x2) / 2;
        const waveY = Math.sin(waveOffset + i * Math.PI) * 3;
        ctx.quadraticCurveTo(midX, cy + r - 2 + waveY, x2, cy + r - 2);
      }
      ctx.closePath();
      ctx.fill();

      // Eyes
      const eyeR = 4;
      // White of eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(cx - 4.5, cy - 3, eyeR, eyeR + 1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 4.5, cy - 3, eyeR, eyeR + 1, 0, 0, Math.PI * 2);
      ctx.fill();

      if (ghost.scared) {
        // Worried expression: small wavy mouth + X eyes
        ctx.fillStyle = '#aaccff';
        ctx.beginPath();
        ctx.arc(cx - 4.5, cy - 3, 2, 0, Math.PI * 2);
        ctx.arc(cx + 4.5, cy - 3, 2, 0, Math.PI * 2);
        ctx.fill();
        // Wavy mouth
        ctx.strokeStyle = '#aaccff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy + 4);
        ctx.quadraticCurveTo(cx - 2.5, cy + 2, cx, cy + 4);
        ctx.quadraticCurveTo(cx + 2.5, cy + 6, cx + 5, cy + 4);
        ctx.stroke();
      } else {
        // Blue pupils
        ctx.fillStyle = '#2244cc';
        ctx.beginPath();
        ctx.arc(cx - 4, cy - 2.5, 2.2, 0, Math.PI * 2);
        ctx.arc(cx + 4, cy - 2.5, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const ghostAI = (ghost: Ghost, pacX: number, pacY: number, maze: number[][]) => {
      const dirs: Direction[] = ['up', 'down', 'left', 'right'];
      const opposite: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left', none: 'none' };
      const validDirs = dirs.filter(d => d !== opposite[ghost.dir] && canMove(maze, ghost.x, ghost.y, d));

      if (validDirs.length === 0) {
        // Dead end, go back
        if (canMove(maze, ghost.x, ghost.y, opposite[ghost.dir])) {
          ghost.dir = opposite[ghost.dir];
        }
        return;
      }

      if (ghost.scared) {
        // Run away randomly
        ghost.dir = validDirs[Math.floor(Math.random() * validDirs.length)];
        return;
      }

      if (ghost.mode === 'chase') {
        // Move towards pac-man
        let bestDir = validDirs[0];
        let bestDist = Infinity;
        for (const d of validDirs) {
          const [nx, ny] = getNextPos(ghost.x, ghost.y, d);
          const dist = Math.abs(nx - pacX) + Math.abs(ny - pacY);
          if (dist < bestDist) { bestDist = dist; bestDir = d; }
        }
        ghost.dir = bestDir;
      } else if (ghost.mode === 'patrol') {
        // Move towards home corner, then wander
        const tx = ghost.homeX;
        const ty = ghost.homeY;
        let bestDir = validDirs[0];
        let bestDist = Infinity;
        for (const d of validDirs) {
          const [nx, ny] = getNextPos(ghost.x, ghost.y, d);
          const dist = Math.abs(nx - tx) + Math.abs(ny - ty);
          if (dist < bestDist) { bestDist = dist; bestDir = d; }
        }
        ghost.dir = bestDir;
      } else {
        // Random
        if (validDirs.includes(ghost.dir) && Math.random() < 0.7) {
          return; // Keep going
        }
        ghost.dir = validDirs[Math.floor(Math.random() * validDirs.length)];
      }
    };

    let lastTime = 0;
    const MOVE_INTERVAL = 150; // ms between pac-man moves
    const GHOST_MOVE_INTERVAL = difficultyConfig.ghostMoveInterval;

    const gameLoop = (timestamp: number) => {
      const gs = gameStateRef.current;
      if (!gs) return;

      const dt = timestamp - lastTime;
      lastTime = timestamp;

      // Background drawn by drawMaze
      drawMaze(gs.maze, gs.frameCount);

      if (gs.readyTimer > 0) {
        gs.readyTimer--;
        // Draw "READY!" text with neon glow
        ctx.shadowColor = '#ffee00';
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#FFFF00';
        ctx.font = `bold ${CELL}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('READY!', canvas.width / 2, canvas.height / 2 + CELL / 3);
        ctx.shadowBlur = 0;
        drawPacMan(gs.pacX, gs.pacY, 'right', 0.5);
        gs.ghosts.forEach(g => drawGhost(g, gs.frameCount));
        animFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      // Death flash freeze
      if (gs.deathFlash > 0) {
        gs.deathFlash--;
        drawPacMan(gs.pacX, gs.pacY, gs.pacDir === 'none' ? 'right' : gs.pacDir, gs.mouthOpen);
        gs.ghosts.forEach(g => drawGhost(g, gs.frameCount));
        const flashAlpha = (gs.deathFlash / 30) * 0.5;
        if (gs.deathFlash > 20) {
          ctx.fillStyle = `rgba(255,255,255,${flashAlpha * 0.6})`;
        } else {
          ctx.fillStyle = `rgba(255,0,0,${flashAlpha})`;
        }
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        animFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      if (gs.gameOver || gs.levelComplete) {
        drawPacMan(gs.pacX, gs.pacY, gs.pacDir, 0.5);
        gs.ghosts.forEach(g => drawGhost(g, gs.frameCount));

        ctx.shadowColor = gs.levelComplete ? '#00ff88' : '#ff2200';
        ctx.shadowBlur = 20;
        ctx.fillStyle = gs.levelComplete ? '#00ff88' : '#ff4444';
        ctx.font = `bold ${CELL * 1.2}px monospace`;
        ctx.textAlign = 'center';
        if (gs.levelComplete) {
          ctx.fillText('LEVEL UP!', canvas.width / 2, canvas.height / 2);
          gs.frameCount++;
          if (gs.frameCount > 90) {
            gs.score += 500;
            setScore(gs.score);
            startNextLevel();
          }
        } else {
          ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
        }
        ctx.shadowBlur = 0;
        animFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      gs.frameCount++;

      // Animate mouth
      gs.mouthOpen += gs.mouthDir * 0.08;
      if (gs.mouthOpen > 1) { gs.mouthOpen = 1; gs.mouthDir = -1; }
      if (gs.mouthOpen < 0) { gs.mouthOpen = 0; gs.mouthDir = 1; }

      // Power timer
      if (gs.powerTimer > 0) {
        gs.powerTimer--;
        if (gs.powerTimer === 0) {
          gs.ghosts.forEach(g => { g.scared = false; });
        }
      }

      // Move pac-man
      gs.moveTimer += dt;
      if (gs.moveTimer >= MOVE_INTERVAL && gs.started) {
        gs.moveTimer = 0;

        // Try next direction first
        if (gs.nextDir !== 'none' && canMove(gs.maze, gs.pacX, gs.pacY, gs.nextDir)) {
          gs.pacDir = gs.nextDir;
        }

        if (gs.pacDir !== 'none' && canMove(gs.maze, gs.pacX, gs.pacY, gs.pacDir)) {
          const [nx, ny] = getNextPos(gs.pacX, gs.pacY, gs.pacDir);
          gs.pacX = nx;
          gs.pacY = ny;

          // Eat dot
          const cell = gs.maze[ny][nx];
          if (cell === 2) {
            gs.maze[ny][nx] = 4;
            gs.score += 10;
            gs.dotsEaten++;
          } else if (cell === 3) {
            gs.maze[ny][nx] = 4;
            gs.score += 50;
            gs.dotsEaten++;
            gs.powerTimer = difficultyConfig.powerDuration;
            gs.ghosts.forEach(g => { if (!g.eaten) g.scared = true; });
          }

          setScore(gs.score);

          // Extra life check
          if (gs.score >= gs.nextExtraLife && gs.lives < MAX_LIVES) {
            gs.lives++;
            gs.nextExtraLife += EXTRA_LIFE_INTERVAL;
            gs.extraLifeFlash = 60;
            setLives(gs.lives);
          }

          if (gs.dotsEaten >= gs.totalDots) {
            gs.levelComplete = true;
            gs.frameCount = 0;
          }
        }
      }

      // Move ghosts
      gs.ghostMoveTimer += dt;
      if (gs.ghostMoveTimer >= GHOST_MOVE_INTERVAL && gs.started) {
        gs.ghostMoveTimer = 0;

        gs.ghosts.forEach(ghost => {
          if (ghost.eaten) return;
          ghostAI(ghost, gs.pacX, gs.pacY, gs.maze);
          if (canMove(gs.maze, ghost.x, ghost.y, ghost.dir)) {
            const [nx, ny] = getNextPos(ghost.x, ghost.y, ghost.dir);
            ghost.x = nx;
            ghost.y = ny;
          }
        });
      }

      // Check collisions
      gs.ghosts.forEach(ghost => {
        if (ghost.eaten) return;
        if (ghost.x === gs.pacX && ghost.y === gs.pacY) {
          if (Date.now() < gs.invincibleUntil && !ghost.scared) return;
          if (ghost.scared) {
            ghost.eaten = true;
            gs.score += 200;
            setScore(gs.score);
            // Extra life check
            if (gs.score >= gs.nextExtraLife && gs.lives < MAX_LIVES) {
              gs.lives++;
              gs.nextExtraLife += EXTRA_LIFE_INTERVAL;
              gs.extraLifeFlash = 60;
              setLives(gs.lives);
            }
          } else {
            gs.lives--;
            setLives(gs.lives);
            if (gs.lives <= 0) {
              gs.gameOver = true;
              finalScoreRef.current = gs.score;
              setScore(gs.score);
              setGameOver(true);
            } else {
              gs.deathFlash = 30;
              gs.invincibleUntil = Date.now() + 2000;
              resetPositions();
            }
          }
        }
      });

      // Draw pac-man and ghosts
      if (Date.now() < gs.invincibleUntil) {
        const t = Date.now() * 0.01;
        ctx.save();
        ctx.globalAlpha = 0.4 + Math.sin(t) * 0.4;
        drawPacMan(gs.pacX, gs.pacY, gs.pacDir === 'none' ? 'right' : gs.pacDir, gs.mouthOpen);
        // Glow ring
        const pcx = gs.pacX * CELL + CELL / 2;
        const pcy = gs.pacY * CELL + CELL / 2;
        ctx.strokeStyle = '#ffee00';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ffee00';
        ctx.shadowBlur = 15 + Math.sin(t * 2) * 10;
        ctx.beginPath();
        ctx.arc(pcx, pcy, CELL / 2 + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        drawPacMan(gs.pacX, gs.pacY, gs.pacDir === 'none' ? 'right' : gs.pacDir, gs.mouthOpen);
      }
      gs.ghosts.forEach(g => drawGhost(g, gs.frameCount));

      // Lives display - mini glossy pac-mans (reserve lives only)
      const reserveLives = Math.max(0, gs.lives - 1);
      if (gs.lives === 1) {
        ctx.fillStyle = '#ff3333';
        ctx.shadowColor = '#ff3333';
        ctx.shadowBlur = 8;
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('LAST LIFE', 10, canvas.height - 12);
        ctx.shadowBlur = 0;
      }
      for (let i = 0; i < reserveLives; i++) {
        const lx = 15 + i * 22;
        const ly = canvas.height - 12;
        const lr = 8;
        const lifeGrad = ctx.createRadialGradient(lx - 2, ly - 2, 1, lx, ly, lr);
        lifeGrad.addColorStop(0, '#ffffaa');
        lifeGrad.addColorStop(0.5, '#ffee00');
        lifeGrad.addColorStop(1, '#cc9900');
        ctx.fillStyle = lifeGrad;
        ctx.shadowColor = '#ffee00';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(lx, ly, lr, 0.25, Math.PI * 2 - 0.25);
        ctx.lineTo(lx, ly);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 1UP flash
      if (gs.extraLifeFlash > 0) {
        gs.extraLifeFlash--;
        ctx.save();
        ctx.globalAlpha = gs.extraLifeFlash / 60;
        ctx.fillStyle = '#00ff88';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 20;
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('1UP!', canvas.width / 2, canvas.height / 2 - 40);
        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animFrameRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [canMove, getNextPos, resetPositions, startNextLevel]);

  // Game over callback
  useEffect(() => {
    if (gameOver && !gameOverCalled) {
      setGameOverCalled(true);
      const timer = setTimeout(() => onGameOver(finalScoreRef.current), 2000);
      return () => clearTimeout(timer);
    }
  }, [gameOver, gameOverCalled, onGameOver]);

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div className="flex justify-between w-full max-w-[400px] px-2 text-white font-mono text-sm">
        <span>Score: {score}</span>
        <span>{lives === 1 ? <span className="text-red-500 animate-pulse">LAST LIFE</span> : `Lives: ${lives - 1}`}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={380}
        height={420}
        className="rounded-lg border-2 border-blue-900 bg-black max-w-full touch-none"
        style={{ imageRendering: 'auto' }}
      />
      <p className="text-xs text-gray-400 font-mono">Arrow keys or swipe to move</p>
    </div>
  );
}
