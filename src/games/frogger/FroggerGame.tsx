'use client';

import { useRef, useEffect, useCallback, useState } from 'react';

interface FroggerGameProps {
  onGameOver: (score: number) => void;
  level: 'easy' | 'medium' | 'hard';
}

const CELL = 40;
const COLS = 13;
const ROWS = 13; // 1 start + 5 road + 1 median + 5 river + 1 home row
const WIDTH = COLS * CELL;
const HEIGHT = ROWS * CELL;

type Lane = {
  row: number;
  type: 'road' | 'river';
  speed: number; // positive = right, negative = left
  items: { x: number; width: number }[];
};

type HomeSpot = {
  x: number;
  filled: boolean;
};

type SplashParticle = {
  x: number; y: number; vx: number; vy: number; life: number; maxLife: number;
};

export default function FroggerGame({ onGameOver, level }: FroggerGameProps) {
  // Level-based settings
  const speedMultiplier = level === 'easy' ? 0.6 : level === 'hard' ? 1.5 : 1.0;
  const logWidthMultiplier = level === 'easy' ? 1.3 : level === 'hard' ? 0.7 : 1.0;
  const initialLives = level === 'easy' ? 5 : level === 'hard' ? 2 : 3;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    frogX: number;
    frogY: number;
    lives: number;
    score: number;
    maxRow: number;
    lanes: Lane[];
    homes: HomeSpot[];
    gameOver: boolean;
    gameOverNotified: boolean;
    animFrame: number;
    lastTime: number;
    deathTimer: number;
    deathX: number;
    deathY: number;
    splashParticles: SplashParticle[];
    waveOffset: number;
  } | null>(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(initialLives);
  const [canvasSize, setCanvasSize] = useState({ w: WIDTH, h: HEIGHT });
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const initState = useCallback(() => {
    const lanes: Lane[] = [];

    // Road lanes (rows 1-5, from bottom)
    const roadSpeeds = [1.2, -1.5, 1.0, -1.8, 1.3].map(s => s * speedMultiplier);
    const roadWidths = [[2, 2, 2], [3, 3], [2, 2, 2, 2], [3, 3, 3], [2, 2, 2]];
    for (let i = 0; i < 5; i++) {
      const row = 11 - i; // rows 11,10,9,8,7
      const items = roadWidths[i].map((w, j) => ({
        x: j * (WIDTH / roadWidths[i].length) + Math.random() * 40,
        width: w * CELL,
      }));
      lanes.push({ row, type: 'road', speed: roadSpeeds[i], items });
    }

    // River lanes (rows 1-5 from top)
    const riverSpeeds = [-0.8, 1.2, -1.0, 1.5, -0.7].map(s => s * speedMultiplier);
    const riverWidths = [[3, 3], [2, 2, 2], [4, 4], [2, 2, 2], [3, 3, 3]].map(
      row => row.map(w => Math.round(w * logWidthMultiplier))
    );
    for (let i = 0; i < 5; i++) {
      const row = 5 - i; // rows 5,4,3,2,1
      const items = riverWidths[i].map((w, j) => ({
        x: j * (WIDTH / riverWidths[i].length) + Math.random() * 30,
        width: w * CELL,
      }));
      lanes.push({ row, type: 'river', speed: riverSpeeds[i], items });
    }

    const homes: HomeSpot[] = [1, 3, 5, 7, 9].map(col => ({
      x: col * CELL,
      filled: false,
    }));

    return {
      frogX: Math.floor(COLS / 2) * CELL,
      frogY: (ROWS - 1) * CELL,
      lives: initialLives,
      score: 0,
      maxRow: ROWS - 1,
      lanes,
      homes,
      gameOver: false,
      gameOverNotified: false,
      animFrame: 0,
      lastTime: 0,
      deathTimer: 0,
      deathX: 0,
      deathY: 0,
      splashParticles: [] as SplashParticle[],
      waveOffset: 0,
    };
  }, [speedMultiplier, logWidthMultiplier, initialLives]);

  const resetFrog = (state: NonNullable<typeof stateRef.current>) => {
    state.frogX = Math.floor(COLS / 2) * CELL;
    state.frogY = (ROWS - 1) * CELL;
    state.maxRow = ROWS - 1;
  };

  const moveFrog = useCallback((dx: number, dy: number) => {
    const s = stateRef.current;
    if (!s || s.gameOver || s.deathTimer > 0) return;

    // Sideways movement is 30% of a cell; forward/back is a full cell
    const stepX = dx !== 0 ? Math.round(CELL * 0.3) : 0;
    const stepY = dy !== 0 ? CELL : 0;
    const newX = s.frogX + dx * stepX;
    const newY = s.frogY + dy * stepY;

    if (newX < 0 || newX >= WIDTH || newY < 0 || newY >= HEIGHT) return;

    s.frogX = newX;
    s.frogY = newY;

    // Score for moving forward
    const row = Math.floor(newY / CELL);
    if (row < s.maxRow) {
      s.score += 10 * (s.maxRow - row);
      s.maxRow = row;
      setDisplayScore(s.score);
    }
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
        e.preventDefault();
      }
      switch (e.key) {
        case 'ArrowUp': case 'w': moveFrog(0, -1); break;
        case 'ArrowDown': case 's': moveFrog(0, 1); break;
        case 'ArrowLeft': case 'a': moveFrog(-1, 0); break;
        case 'ArrowRight': case 'd': moveFrog(1, 0); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [moveFrog]);

  // Touch swipe
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      touchStart.current = { x: t.clientX, y: t.clientY };
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (!touchStart.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.current.x;
      const dy = t.clientY - touchStart.current.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (Math.max(absDx, absDy) < 20) {
        // Tap = move up
        moveFrog(0, -1);
      } else if (absDx > absDy) {
        moveFrog(dx > 0 ? 1 : -1, 0);
      } else {
        moveFrog(0, dy > 0 ? 1 : -1);
      }
      touchStart.current = null;
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [moveFrog]);

  // Resize
  useEffect(() => {
    const resize = () => {
      const maxW = Math.min(window.innerWidth - 32, 520);
      const scale = Math.min(maxW / WIDTH, 1);
      setCanvasSize({ w: WIDTH * scale, h: HEIGHT * scale });
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    stateRef.current = initState();

    const spawnSplash = (x: number, y: number) => {
      const s = stateRef.current!;
      for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        s.splashParticles.push({
          x: x + CELL / 2,
          y: y + CELL / 2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1,
          life: 20 + Math.random() * 15,
          maxLife: 35,
        });
      }
    };

    const drawGrassZone = (y: number, h: number) => {
      const grad = ctx.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, '#0a3a15');
      grad.addColorStop(0.3, '#0d4a1c');
      grad.addColorStop(0.7, '#0b3f18');
      grad.addColorStop(1, '#083212');
      ctx.fillStyle = grad;
      ctx.fillRect(0, y, WIDTH, h);

      // Grass texture dots
      ctx.fillStyle = 'rgba(40, 180, 60, 0.15)';
      for (let gx = 0; gx < WIDTH; gx += 8) {
        for (let gy = y + 3; gy < y + h - 3; gy += 8) {
          if (Math.random() > 0.6) {
            ctx.beginPath();
            ctx.arc(gx + Math.random() * 6, gy + Math.random() * 6, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    };

    const drawRoad = (y: number, h: number) => {
      // Asphalt gradient
      const roadGrad = ctx.createLinearGradient(0, y, 0, y + h);
      roadGrad.addColorStop(0, '#1a1a1f');
      roadGrad.addColorStop(0.5, '#222228');
      roadGrad.addColorStop(1, '#1a1a1f');
      ctx.fillStyle = roadGrad;
      ctx.fillRect(0, y, WIDTH, h);

      // Road edge lines (solid yellow)
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y + 1);
      ctx.lineTo(WIDTH, y + 1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, y + h - 1);
      ctx.lineTo(WIDTH, y + h - 1);
      ctx.stroke();
    };

    const drawLaneMarkings = (row: number) => {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.setLineDash([14, 10]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, row * CELL);
      ctx.lineTo(WIDTH, row * CELL);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const drawWater = (y: number, h: number, waveOffset: number) => {
      // Deep water gradient
      const waterGrad = ctx.createLinearGradient(0, y, 0, y + h);
      waterGrad.addColorStop(0, '#041830');
      waterGrad.addColorStop(0.3, '#062a50');
      waterGrad.addColorStop(0.6, '#0a3060');
      waterGrad.addColorStop(1, '#041830');
      ctx.fillStyle = waterGrad;
      ctx.fillRect(0, y, WIDTH, h);

      // Animated wave ripples
      ctx.strokeStyle = 'rgba(100, 180, 255, 0.12)';
      ctx.lineWidth = 1;
      for (let wy = y + 5; wy < y + h; wy += 12) {
        ctx.beginPath();
        for (let wx = 0; wx < WIDTH; wx += 2) {
          const waveY = wy + Math.sin((wx + waveOffset * 2) * 0.05) * 2.5 + Math.sin((wx + waveOffset) * 0.08) * 1.5;
          if (wx === 0) ctx.moveTo(wx, waveY);
          else ctx.lineTo(wx, waveY);
        }
        ctx.stroke();
      }

      // Shimmer highlights
      ctx.fillStyle = 'rgba(120, 200, 255, 0.06)';
      for (let sx = 0; sx < WIDTH; sx += 30) {
        const shimmerY = y + h * 0.3 + Math.sin((sx + waveOffset * 1.5) * 0.04) * 8;
        ctx.beginPath();
        ctx.ellipse(sx, shimmerY, 10, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawCar = (x: number, y: number, w: number, speed: number, isLong: boolean) => {
      const h = CELL - 8;
      const carY = y + 4;
      const facingRight = speed > 0;

      // Car body gradient
      const bodyGrad = ctx.createLinearGradient(x, carY, x, carY + h);
      if (isLong) {
        bodyGrad.addColorStop(0, '#ef4444');
        bodyGrad.addColorStop(0.5, '#dc2626');
        bodyGrad.addColorStop(1, '#991b1b');
      } else {
        bodyGrad.addColorStop(0, '#fbbf24');
        bodyGrad.addColorStop(0.5, '#f59e0b');
        bodyGrad.addColorStop(1, '#b45309');
      }

      // Rounded car body
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.roundRect(x + 2, carY, w - 4, h, 6);
      ctx.fill();

      // Roof section (slightly darker, inset)
      ctx.fillStyle = isLong ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.12)';
      const roofInset = isLong ? w * 0.15 : w * 0.2;
      ctx.beginPath();
      ctx.roundRect(x + roofInset, carY + 3, w - roofInset * 2, h - 6, 4);
      ctx.fill();

      // Windshield with blue glow
      const windW = Math.min(14, w * 0.18);
      const windX = facingRight ? x + w - windW - 8 : x + 8;
      const windGrad = ctx.createLinearGradient(windX, carY, windX, carY + h);
      windGrad.addColorStop(0, '#93c5fd');
      windGrad.addColorStop(1, '#3b82f6');
      ctx.fillStyle = windGrad;
      ctx.beginPath();
      ctx.roundRect(windX, carY + 5, windW, h - 10, 2);
      ctx.fill();

      // Headlights (glowing)
      const headX = facingRight ? x + w - 5 : x + 2;
      ctx.shadowColor = '#fffbe6';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#fffbe6';
      ctx.beginPath();
      ctx.ellipse(headX, carY + 7, 3, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(headX, carY + h - 7, 3, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Tail lights
      const tailX = facingRight ? x + 4 : x + w - 6;
      ctx.fillStyle = '#ff3333';
      ctx.shadowColor = '#ff3333';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.ellipse(tailX, carY + 7, 2, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(tailX, carY + h - 7, 2, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Wheels
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.roundRect(x + 8, carY + h - 3, 10, 4, 2);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x + w - 18, carY + h - 3, 10, 4, 2);
      ctx.fill();
      // Wheel highlights
      ctx.fillStyle = '#444';
      ctx.beginPath();
      ctx.roundRect(x + 10, carY + h - 2, 6, 1.5, 1);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x + w - 16, carY + h - 2, 6, 1.5, 1);
      ctx.fill();
    };

    const drawLog = (x: number, y: number, w: number) => {
      const logY = y + 6;
      const logH = CELL - 12;

      // Log body gradient
      const logGrad = ctx.createLinearGradient(x, logY, x, logY + logH);
      logGrad.addColorStop(0, '#a0714a');
      logGrad.addColorStop(0.3, '#8B5E3C');
      logGrad.addColorStop(0.5, '#7a4f30');
      logGrad.addColorStop(0.7, '#8B5E3C');
      logGrad.addColorStop(1, '#6b4226');
      ctx.fillStyle = logGrad;
      ctx.beginPath();
      ctx.roundRect(x + 2, logY, w - 4, logH, logH / 2);
      ctx.fill();

      // Wood grain lines
      ctx.strokeStyle = 'rgba(100, 60, 20, 0.35)';
      ctx.lineWidth = 1;
      for (let lx = x + 14; lx < x + w - 10; lx += 18) {
        ctx.beginPath();
        ctx.moveTo(lx, logY + 4);
        ctx.bezierCurveTo(lx + 3, logY + logH * 0.3, lx - 3, logY + logH * 0.7, lx + 1, logY + logH - 4);
        ctx.stroke();
      }

      // Knots
      ctx.fillStyle = 'rgba(80, 45, 15, 0.4)';
      for (let kx = x + 20; kx < x + w - 15; kx += 35) {
        ctx.beginPath();
        ctx.ellipse(kx, logY + logH / 2, 3, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // End rings (round cuts)
      ctx.fillStyle = '#a07050';
      ctx.beginPath();
      ctx.ellipse(x + 5, logY + logH / 2, 5, logH / 2 - 1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(70, 40, 15, 0.5)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.ellipse(x + 5, logY + logH / 2, 3, logH / 2 - 3, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#a07050';
      ctx.beginPath();
      ctx.ellipse(x + w - 5, logY + logH / 2, 5, logH / 2 - 1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(70, 40, 15, 0.5)';
      ctx.beginPath();
      ctx.ellipse(x + w - 5, logY + logH / 2, 3, logH / 2 - 3, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Highlight along top
      ctx.strokeStyle = 'rgba(200, 160, 100, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 8, logY + 2);
      ctx.lineTo(x + w - 8, logY + 2);
      ctx.stroke();
    };

    const drawLilyPad = (x: number, y: number, filled: boolean) => {
      const cx = x + CELL / 2;
      const cy = y + CELL / 2;

      // Glow
      if (!filled) {
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 12;
      } else {
        ctx.shadowColor = '#4ade80';
        ctx.shadowBlur = 16;
      }

      // Lily pad
      const padGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 16);
      if (filled) {
        padGrad.addColorStop(0, '#86efac');
        padGrad.addColorStop(1, '#22c55e');
      } else {
        padGrad.addColorStop(0, '#065f46');
        padGrad.addColorStop(0.6, '#064e3b');
        padGrad.addColorStop(1, '#022c22');
      }
      ctx.fillStyle = padGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 15, 13, 0, 0.15, Math.PI * 2 - 0.15);
      ctx.lineTo(cx, cy);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Veins
      ctx.strokeStyle = filled ? 'rgba(255,255,255,0.2)' : 'rgba(0,255,136,0.15)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < 3; i++) {
        const a = 0.5 + i * 1.0;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 13, cy + Math.sin(a) * 11);
        ctx.stroke();
      }
    };

    const drawFrog = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, small: boolean) => {
      const sc = small ? 0.65 : 1;
      const cx = x + size / 2;
      const cy = y + size / 2;

      // Body glow
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = small ? 4 : 10;

      // Body gradient
      const bodyGrad = ctx.createRadialGradient(cx, cy - 2 * sc, 2 * sc, cx, cy, 16 * sc);
      bodyGrad.addColorStop(0, '#4ade80');
      bodyGrad.addColorStop(0.6, '#22c55e');
      bodyGrad.addColorStop(1, '#15803d');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 14 * sc, 15 * sc, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Belly
      ctx.fillStyle = 'rgba(134, 239, 172, 0.3)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 2 * sc, 8 * sc, 10 * sc, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eyes (with white glow)
      const eyeY = cy - 10 * sc;
      // Left eye
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.arc(cx - 7 * sc, eyeY, 5.5 * sc, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Left pupil
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(cx - 7 * sc, eyeY, 2.8 * sc, 0, Math.PI * 2);
      ctx.fill();
      // Left highlight
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(cx - 8.5 * sc, eyeY - 1.5 * sc, 1.2 * sc, 0, Math.PI * 2);
      ctx.fill();

      // Right eye
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.arc(cx + 7 * sc, eyeY, 5.5 * sc, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(cx + 7 * sc, eyeY, 2.8 * sc, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(cx + 5.5 * sc, eyeY - 1.5 * sc, 1.2 * sc, 0, Math.PI * 2);
      ctx.fill();

      if (!small) {
        // Back legs
        ctx.fillStyle = '#16a34a';
        // Left back leg
        ctx.beginPath();
        ctx.ellipse(cx - 14 * sc, cy + 8 * sc, 7 * sc, 5 * sc, -0.3, 0, Math.PI * 2);
        ctx.fill();
        // Left foot
        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.ellipse(cx - 18 * sc, cy + 12 * sc, 5 * sc, 3 * sc, -0.5, 0, Math.PI * 2);
        ctx.fill();

        // Right back leg
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.ellipse(cx + 14 * sc, cy + 8 * sc, 7 * sc, 5 * sc, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.ellipse(cx + 18 * sc, cy + 12 * sc, 5 * sc, 3 * sc, 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Front legs
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.ellipse(cx - 10 * sc, cy - 4 * sc, 4 * sc, 6 * sc, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + 10 * sc, cy - 4 * sc, 4 * sc, 6 * sc, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Mouth (little smile)
      ctx.strokeStyle = 'rgba(0,80,30,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy - 2 * sc, 4 * sc, 0.2, Math.PI - 0.2);
      ctx.stroke();
    };

    const drawSplashParticles = (ctx: CanvasRenderingContext2D, particles: SplashParticle[]) => {
      for (const p of particles) {
        const alpha = (p.life / p.maxLife) * 0.8;
        const size = 2 + (1 - p.life / p.maxLife) * 2;
        ctx.fillStyle = `rgba(100, 180, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const gameLoop = (time: number) => {
      const s = stateRef.current!;
      if (s.gameOver) return;

      const dt = s.lastTime ? (time - s.lastTime) / 16.67 : 1;
      s.lastTime = time;
      s.waveOffset += dt * 0.8;

      // Update splash particles
      s.splashParticles = s.splashParticles.filter(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.1 * dt;
        p.life -= dt;
        return p.life > 0;
      });

      // Death animation
      if (s.deathTimer > 0) {
        s.deathTimer -= dt;
        if (s.deathTimer <= 0) {
          s.lives--;
          setDisplayLives(s.lives);
          if (s.lives <= 0) {
            s.gameOver = true;
            if (!s.gameOverNotified) {
              s.gameOverNotified = true;
              setTimeout(() => onGameOver(s.score), 2500);
            }
            return;
          }
          resetFrog(s);
        }
        drawFrame(ctx, s);
        s.animFrame = requestAnimationFrame(gameLoop);
        return;
      }

      // Update lane items
      for (const lane of s.lanes) {
        for (const item of lane.items) {
          item.x += lane.speed * dt;
          // Wrap around
          if (lane.speed > 0 && item.x > WIDTH) item.x = -item.width;
          if (lane.speed < 0 && item.x + item.width < 0) item.x = WIDTH;
        }
      }

      // Check collisions
      const frogRow = Math.round(s.frogY / CELL);
      const frogCenterX = s.frogX + CELL / 2;

      // Check home spots (row 0)
      if (frogRow === 0) {
        let landed = false;
        for (const home of s.homes) {
          if (!home.filled && Math.abs(s.frogX - home.x) < CELL * 0.8) {
            home.filled = true;
            s.score += 50;
            setDisplayScore(s.score);
            landed = true;
            resetFrog(s);

            // Check if all homes filled
            if (s.homes.every(h => h.filled)) {
              s.score += 100;
              setDisplayScore(s.score);
              s.gameOver = true;
              setTimeout(() => onGameOver(s.score), 1000);
            }
            break;
          }
        }
        if (!landed) {
          // Missed home spot
          s.deathTimer = 30;
          s.deathX = s.frogX;
          s.deathY = s.frogY;
        }
      }

      // Road collision
      const roadLane = s.lanes.find(l => l.type === 'road' && l.row === frogRow);
      if (roadLane) {
        for (const item of roadLane.items) {
          if (frogCenterX > item.x && frogCenterX < item.x + item.width &&
              Math.abs(s.frogY - roadLane.row * CELL) < CELL * 0.6) {
            s.deathTimer = 30;
            s.deathX = s.frogX;
            s.deathY = s.frogY;
            break;
          }
        }
      }

      // River - must be on a log
      const riverLane = s.lanes.find(l => l.type === 'river' && l.row === frogRow);
      if (riverLane && s.deathTimer <= 0) {
        let onLog = false;
        for (const item of riverLane.items) {
          if (frogCenterX > item.x && frogCenterX < item.x + item.width) {
            onLog = true;
            // Ride the log
            s.frogX += riverLane.speed * dt;
            // Fall off screen
            if (s.frogX < -CELL || s.frogX > WIDTH) {
              s.deathTimer = 30;
              s.deathX = s.frogX;
              s.deathY = s.frogY;
              spawnSplash(s.frogX, s.frogY);
            }
            break;
          }
        }
        if (!onLog) {
          s.deathTimer = 30;
          s.deathX = s.frogX;
          s.deathY = s.frogY;
          spawnSplash(s.frogX, s.frogY);
        }
      }

      drawFrame(ctx, s);
      s.animFrame = requestAnimationFrame(gameLoop);
    };

    const drawFrame = (ctx: CanvasRenderingContext2D, s: NonNullable<typeof stateRef.current>) => {
      // Dark background
      ctx.fillStyle = '#080810';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // Home zone (row 0)
      drawGrassZone(0, CELL);

      // River (rows 1-5)
      drawWater(1 * CELL, 5 * CELL, s.waveOffset);

      // Median (row 6)
      drawGrassZone(6 * CELL, CELL);

      // Road (rows 7-11)
      drawRoad(7 * CELL, 5 * CELL);

      // Lane markings
      for (let r = 8; r < 12; r++) {
        drawLaneMarkings(r);
      }

      // Start zone (row 12)
      drawGrassZone(12 * CELL, CELL);

      // Home spots
      for (const home of s.homes) {
        drawLilyPad(home.x, 0, home.filled);
        if (home.filled) {
          drawFrog(ctx, home.x, 0, CELL, true);
        }
      }

      // Draw lane items
      for (const lane of s.lanes) {
        for (const item of lane.items) {
          if (lane.type === 'road') {
            const isLong = item.width > CELL * 2.5;
            drawCar(item.x, lane.row * CELL, item.width, lane.speed, isLong);
          } else {
            drawLog(item.x, lane.row * CELL, item.width);
          }
        }
      }

      // Splash particles
      drawSplashParticles(ctx, s.splashParticles);

      // Death animation
      if (s.deathTimer > 0) {
        const progress = 1 - s.deathTimer / 30;
        // Expanding ring
        ctx.strokeStyle = `rgba(255, 80, 80, ${1 - progress})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.deathX + CELL / 2, s.deathY + CELL / 2, CELL * (0.3 + progress * 0.8), 0, Math.PI * 2);
        ctx.stroke();
        // Inner flash
        ctx.fillStyle = `rgba(255, 100, 100, ${(1 - progress) * 0.4})`;
        ctx.beginPath();
        ctx.arc(s.deathX + CELL / 2, s.deathY + CELL / 2, CELL * (0.3 + progress * 0.5), 0, Math.PI * 2);
        ctx.fill();
        // X mark
        ctx.fillStyle = `rgba(255, 255, 255, ${1 - progress})`;
        ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('X', s.deathX + CELL / 2, s.deathY + CELL / 2 + 8);
      } else {
        // Draw frog
        drawFrog(ctx, s.frogX, s.frogY, CELL, false);
      }
    };

    const s = stateRef.current!;
    s.animFrame = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(s.animFrame);
    };
  }, [initState, onGameOver]);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <h2 className="text-xl font-bold text-white tracking-wider">FROGGER</h2>

      <div className="flex items-center justify-between w-full max-w-[520px] px-4">
        <div className="text-green-400 font-mono font-bold text-lg">
          SCORE: {displayScore}
        </div>
        <div className="text-red-400 font-mono font-bold text-lg flex items-center gap-1">
          {'🐸'.repeat(displayLives)}
        </div>
      </div>

      <p className="text-zinc-500 text-xs">Swipe or arrow keys | Tap to hop forward</p>

      <canvas
        ref={canvasRef}
        style={{ width: canvasSize.w, height: canvasSize.h }}
        className="rounded-lg border-2 border-zinc-700 touch-none"
      />
    </div>
  );
}
