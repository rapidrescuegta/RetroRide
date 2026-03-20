'use client';

import { useRef, useEffect, useCallback, useState } from 'react';

interface BreakoutGameProps {
  onGameOver: (score: number) => void;
}

const BRICK_ROWS = 6;
const BRICK_COLS = 10;
const BRICK_GAP = 3;
const PADDLE_HEIGHT_RATIO = 0.02;
const PADDLE_WIDTH_RATIO = 0.15;
const BALL_RADIUS_RATIO = 0.01;
const BALL_SPEED_RATIO = 0.005;
const INITIAL_LIVES = 3;

const ROW_COLORS = [
  '#ff2255', // red
  '#ff6622', // orange
  '#ffcc00', // yellow
  '#22dd66', // green
  '#2288ff', // blue
  '#aa44ff', // purple
];

type Brick = { x: number; y: number; w: number; h: number; color: string; alive: boolean; row: number };

export default function BreakoutGame({ onGameOver }: BreakoutGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    paddleX: number;
    paddleW: number;
    paddleH: number;
    ballX: number;
    ballY: number;
    ballVX: number;
    ballVY: number;
    ballR: number;
    ballSpeed: number;
    bricks: Brick[];
    score: number;
    lives: number;
    gameOver: boolean;
    gameOverNotified: boolean;
    won: boolean;
    w: number;
    h: number;
    launched: boolean;
    particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }>;
  } | null>(null);
  const animRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());
  const touchXRef = useRef<number | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 500, height: 600 });

  const getSize = useCallback(() => {
    const maxW = Math.min(window.innerWidth - 32, 600);
    const maxH = Math.min(window.innerHeight - 120, 700);
    const aspect = 5 / 7;
    let w = maxW;
    let h = w / aspect;
    if (h > maxH) { h = maxH; w = h * aspect; }
    return { width: Math.floor(w), height: Math.floor(h) };
  }, []);

  const createBricks = useCallback((w: number, h: number): Brick[] => {
    const bricks: Brick[] = [];
    const topOffset = h * 0.12;
    const brickAreaW = w - BRICK_GAP * 2;
    const brickW = (brickAreaW - BRICK_GAP * (BRICK_COLS - 1)) / BRICK_COLS;
    const brickH = Math.max(12, h * 0.028);

    for (let row = 0; row < BRICK_ROWS; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        bricks.push({
          x: BRICK_GAP + col * (brickW + BRICK_GAP),
          y: topOffset + row * (brickH + BRICK_GAP),
          w: brickW,
          h: brickH,
          color: ROW_COLORS[row % ROW_COLORS.length],
          alive: true,
          row,
        });
      }
    }
    return bricks;
  }, []);

  const resetBall = useCallback((s: NonNullable<typeof stateRef.current>) => {
    s.ballX = s.paddleX;
    s.ballY = s.h - s.paddleH * 3 - s.ballR - 2;
    s.ballVX = 0;
    s.ballVY = 0;
    s.launched = false;
  }, []);

  const launchBall = useCallback((s: NonNullable<typeof stateRef.current>) => {
    if (s.launched) return;
    s.launched = true;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    s.ballVX = Math.cos(angle) * s.ballSpeed;
    s.ballVY = Math.sin(angle) * s.ballSpeed;
  }, []);

  const initGame = useCallback(() => {
    const { width: w, height: h } = getSize();
    setCanvasSize({ width: w, height: h });
    const paddleW = Math.max(60, w * PADDLE_WIDTH_RATIO);
    const paddleH = Math.max(8, h * PADDLE_HEIGHT_RATIO);
    const ballR = Math.max(4, Math.min(w, h) * BALL_RADIUS_RATIO);
    const s: NonNullable<typeof stateRef.current> = {
      paddleX: w / 2,
      paddleW,
      paddleH,
      ballX: w / 2,
      ballY: h - paddleH * 3 - ballR - 2,
      ballVX: 0,
      ballVY: 0,
      ballR,
      ballSpeed: Math.max(3, h * BALL_SPEED_RATIO),
      bricks: createBricks(w, h),
      score: 0,
      lives: INITIAL_LIVES,
      gameOver: false,
      gameOverNotified: false,
      won: false,
      w, h,
      launched: false,
      particles: [],
    };
    stateRef.current = s;
  }, [getSize, createBricks]);

  const spawnParticles = useCallback((x: number, y: number, color: string, count: number) => {
    const s = stateRef.current;
    if (!s) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      s.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 20 + Math.random() * 20,
        color,
        size: 1 + Math.random() * 3,
      });
    }
  }, []);

  const ballTrailRef = useRef<Array<{ x: number; y: number; alpha: number }>>([]);

  const drawHeart = useCallback((ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) => {
    ctx.beginPath();
    const topY = cy - size * 0.4;
    ctx.moveTo(cx, cy + size * 0.5);
    ctx.bezierCurveTo(cx - size * 0.8, cy - size * 0.1, cx - size * 0.5, topY - size * 0.4, cx, topY + size * 0.15);
    ctx.bezierCurveTo(cx + size * 0.5, topY - size * 0.4, cx + size * 0.8, cy - size * 0.1, cx, cy + size * 0.5);
    ctx.closePath();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const s = stateRef.current;
    if (!canvas || !s) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const time = Date.now() * 0.001;

    // Background with radial gradient
    const bgGrad = ctx.createRadialGradient(
      s.w / 2, s.h * 0.3, 0,
      s.w / 2, s.h * 0.3, s.w * 0.9
    );
    bgGrad.addColorStop(0, '#141428');
    bgGrad.addColorStop(1, '#08080f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, s.w, s.h);

    // Bricks with gradient fills, rounded corners, and inner glow
    s.bricks.forEach(brick => {
      if (!brick.alive) return;

      // Parse brick color for gradient
      const brickGrad = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.h);
      brickGrad.addColorStop(0, brick.color);
      brickGrad.addColorStop(1, brick.color + '99');

      // Outer glow
      ctx.shadowColor = brick.color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = brickGrad;
      ctx.beginPath();
      ctx.roundRect(brick.x, brick.y, brick.w, brick.h, 4);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Inner glow / highlight at top
      const highlightGrad = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.h);
      highlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
      highlightGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.05)');
      highlightGrad.addColorStop(1, 'rgba(0, 0, 0, 0.15)');
      ctx.fillStyle = highlightGrad;
      ctx.beginPath();
      ctx.roundRect(brick.x + 1, brick.y + 1, brick.w - 2, brick.h - 2, 3);
      ctx.fill();

      // Subtle border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.roundRect(brick.x + 0.5, brick.y + 0.5, brick.w - 1, brick.h - 1, 4);
      ctx.stroke();
    });

    // Particles with glow
    s.particles.forEach(p => {
      const alpha = Math.max(0, p.life / 40);
      ctx.globalAlpha = alpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha + 0.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Paddle with neon glow, gradient, and rounded shape
    const paddleY = s.h - s.paddleH * 3;
    const paddleLeft = s.paddleX - s.paddleW / 2;
    const paddleGrad = ctx.createLinearGradient(paddleLeft, paddleY, paddleLeft + s.paddleW, paddleY);
    paddleGrad.addColorStop(0, '#0088cc');
    paddleGrad.addColorStop(0.3, '#00ccff');
    paddleGrad.addColorStop(0.7, '#00ccff');
    paddleGrad.addColorStop(1, '#0088cc');
    ctx.shadowColor = '#00ccff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = paddleGrad;
    ctx.beginPath();
    ctx.roundRect(paddleLeft, paddleY, s.paddleW, s.paddleH, s.paddleH / 2);
    ctx.fill();
    // Highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.roundRect(paddleLeft + 3, paddleY + 1, s.paddleW - 6, s.paddleH * 0.4, s.paddleH / 2);
    ctx.fill();

    // Ball trail
    if (!s.gameOver && s.launched) {
      ballTrailRef.current.push({ x: s.ballX, y: s.ballY, alpha: 1 });
      ballTrailRef.current = ballTrailRef.current
        .map(t => ({ ...t, alpha: t.alpha - 0.1 }))
        .filter(t => t.alpha > 0);

      // Draw motion trail
      ballTrailRef.current.forEach(t => {
        const trailGrad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, s.ballR * 2.5);
        trailGrad.addColorStop(0, `rgba(255, 255, 255, ${t.alpha * 0.25})`);
        trailGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = trailGrad;
        ctx.fillRect(t.x - s.ballR * 3, t.y - s.ballR * 3, s.ballR * 6, s.ballR * 6);
      });
    }

    // Ball with bright glow
    if (!s.gameOver) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 20;
      const ballGrad = ctx.createRadialGradient(
        s.ballX - s.ballR * 0.2, s.ballY - s.ballR * 0.2, 0,
        s.ballX, s.ballY, s.ballR
      );
      ballGrad.addColorStop(0, '#ffffff');
      ballGrad.addColorStop(0.7, '#ddddff');
      ballGrad.addColorStop(1, '#aaaaee');
      ctx.fillStyle = ballGrad;
      ctx.beginPath();
      ctx.arc(s.ballX, s.ballY, s.ballR, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // HUD - Score with glow
    const hudY = s.h - 12;
    ctx.shadowColor = '#00ccff';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#00ccff';
    ctx.font = `bold ${Math.max(12, s.w * 0.028)}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('SCORE', 10, hudY);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${s.score}`, 10 + ctx.measureText('SCORE ').width, hudY);

    // Lives as glowing hearts
    const heartSize = Math.max(8, s.w * 0.018);
    const heartSpacing = heartSize * 2.5;
    const heartsStartX = s.w - 12 - (s.lives - 1) * heartSpacing;
    for (let i = 0; i < s.lives; i++) {
      const hx = heartsStartX + i * heartSpacing;
      const hy = hudY - 4;
      const pulse = 1 + Math.sin(time * 3 + i * 0.5) * 0.1;
      ctx.save();
      ctx.shadowColor = '#ff2255';
      ctx.shadowBlur = 10;
      const heartGrad = ctx.createRadialGradient(hx, hy, 0, hx, hy, heartSize * pulse);
      heartGrad.addColorStop(0, '#ff4477');
      heartGrad.addColorStop(1, '#cc1144');
      ctx.fillStyle = heartGrad;
      drawHeart(ctx, hx, hy, heartSize * pulse);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Highlight on heart
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      drawHeart(ctx, hx - heartSize * 0.05, hy - heartSize * 0.1, heartSize * pulse * 0.5);
      ctx.fill();
      ctx.restore();
    }

    // Launch prompt
    if (!s.launched && !s.gameOver) {
      const promptAlpha = 0.4 + Math.sin(time * 4) * 0.2;
      ctx.fillStyle = `rgba(255, 255, 255, ${promptAlpha})`;
      ctx.font = `${Math.max(11, s.w * 0.025)}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('TAP or SPACE to launch', s.w / 2, s.h * 0.55);
    }

    // Game over
    if (s.gameOver) {
      const overlayGrad = ctx.createRadialGradient(
        s.w / 2, s.h / 2, 0,
        s.w / 2, s.h / 2, s.w * 0.6
      );
      overlayGrad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
      overlayGrad.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
      ctx.fillStyle = overlayGrad;
      ctx.fillRect(0, 0, s.w, s.h);

      const resultColor = s.won ? '#00ff88' : '#ff2255';
      ctx.shadowColor = resultColor;
      ctx.shadowBlur = 30;
      ctx.fillStyle = resultColor;
      ctx.font = `bold ${s.w * 0.07}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(s.won ? 'YOU WIN!' : 'GAME OVER', s.w / 2, s.h / 2 - 20);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${s.w * 0.045}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillText(`Score: ${s.score}`, s.w / 2, s.h / 2 + 25);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = `${s.w * 0.025}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillText('Tap or press any key to restart', s.w / 2, s.h / 2 + 65);
    }
  }, [drawHeart]);

  const update = useCallback(() => {
    const s = stateRef.current;
    if (!s || s.gameOver) return;

    // Paddle movement
    const paddleSpeed = s.w * 0.012;
    if (keysRef.current.has('ArrowLeft') || keysRef.current.has('a')) {
      s.paddleX = Math.max(s.paddleW / 2, s.paddleX - paddleSpeed);
    }
    if (keysRef.current.has('ArrowRight') || keysRef.current.has('d')) {
      s.paddleX = Math.min(s.w - s.paddleW / 2, s.paddleX + paddleSpeed);
    }

    // Touch
    if (touchXRef.current !== null) {
      s.paddleX = Math.max(s.paddleW / 2, Math.min(s.w - s.paddleW / 2, touchXRef.current));
    }

    // Ball follows paddle before launch
    if (!s.launched) {
      s.ballX = s.paddleX;
      s.ballY = s.h - s.paddleH * 3 - s.ballR - 2;
      return;
    }

    // Move ball
    s.ballX += s.ballVX;
    s.ballY += s.ballVY;

    // Wall bounces
    if (s.ballX - s.ballR <= 0) {
      s.ballX = s.ballR;
      s.ballVX = Math.abs(s.ballVX);
    }
    if (s.ballX + s.ballR >= s.w) {
      s.ballX = s.w - s.ballR;
      s.ballVX = -Math.abs(s.ballVX);
    }
    if (s.ballY - s.ballR <= 0) {
      s.ballY = s.ballR;
      s.ballVY = Math.abs(s.ballVY);
    }

    // Paddle collision
    const paddleY = s.h - s.paddleH * 3;
    if (
      s.ballY + s.ballR >= paddleY &&
      s.ballY + s.ballR <= paddleY + s.paddleH + 4 &&
      s.ballX >= s.paddleX - s.paddleW / 2 - s.ballR &&
      s.ballX <= s.paddleX + s.paddleW / 2 + s.ballR &&
      s.ballVY > 0
    ) {
      const hitPos = (s.ballX - s.paddleX) / (s.paddleW / 2);
      const angle = hitPos * Math.PI * 0.35 - Math.PI / 2;
      const speed = Math.sqrt(s.ballVX ** 2 + s.ballVY ** 2);
      s.ballVX = Math.cos(angle) * speed;
      s.ballVY = Math.sin(angle) * speed;
      // Ensure ball goes up
      if (s.ballVY > 0) s.ballVY = -s.ballVY;
      s.ballY = paddleY - s.ballR;
      spawnParticles(s.ballX, s.ballY, '#00ccff', 6);
    }

    // Brick collision
    for (const brick of s.bricks) {
      if (!brick.alive) continue;

      const closestX = Math.max(brick.x, Math.min(s.ballX, brick.x + brick.w));
      const closestY = Math.max(brick.y, Math.min(s.ballY, brick.y + brick.h));
      const dx = s.ballX - closestX;
      const dy = s.ballY - closestY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= s.ballR) {
        brick.alive = false;
        s.score += 10;
        spawnParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.color, 12);

        // Determine bounce direction
        const overlapX = s.ballR - Math.abs(s.ballX - (brick.x + brick.w / 2)) + brick.w / 2;
        const overlapY = s.ballR - Math.abs(s.ballY - (brick.y + brick.h / 2)) + brick.h / 2;

        if (overlapX < overlapY) {
          s.ballVX *= -1;
        } else {
          s.ballVY *= -1;
        }

        // Check win
        if (s.bricks.every(b => !b.alive)) {
          s.gameOver = true;
          s.won = true;
          if (!s.gameOverNotified) {
            s.gameOverNotified = true;
            setTimeout(() => onGameOver(s.score), 2500);
          }
          return;
        }
        break; // Only one brick per frame
      }
    }

    // Ball falls below
    if (s.ballY - s.ballR > s.h) {
      s.lives--;
      spawnParticles(s.ballX, s.h, '#ff2255', 15);
      if (s.lives <= 0) {
        s.gameOver = true;
        s.won = false;
        if (!s.gameOverNotified) {
          s.gameOverNotified = true;
          setTimeout(() => onGameOver(s.score), 2500);
        }
        return;
      }
      resetBall(s);
    }

    // Update particles
    s.particles = s.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1; // gravity
      p.life--;
      return p.life > 0;
    });
  }, [onGameOver, resetBall, spawnParticles]);

  const gameLoop = useCallback(() => {
    update();
    draw();
    animRef.current = requestAnimationFrame(gameLoop);
  }, [update, draw]);

  const restart = useCallback(() => {
    initGame();
    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(gameLoop);
  }, [initGame, gameLoop]);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (s?.gameOver) { restart(); return; }
      if (['ArrowLeft', 'ArrowRight', ' ', 'a', 'd'].includes(e.key)) e.preventDefault();
      if (e.key === ' ' && s && !s.launched) launchBall(s);
      keysRef.current.add(e.key);
    };
    const up = (e: KeyboardEvent) => { keysRef.current.delete(e.key); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [restart, launchBall]);

  // Touch
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getX = (e: TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      return e.touches[0].clientX - rect.left;
    };

    const start = (e: TouchEvent) => {
      e.preventDefault();
      const s = stateRef.current;
      if (s?.gameOver) { restart(); return; }
      touchXRef.current = getX(e);
      if (s && !s.launched) launchBall(s);
    };
    const move = (e: TouchEvent) => {
      e.preventDefault();
      touchXRef.current = getX(e);
    };
    const end = (e: TouchEvent) => {
      e.preventDefault();
      touchXRef.current = null;
    };

    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', end);
    };
  }, [restart, launchBall]);

  // Init
  useEffect(() => {
    initGame();
    animRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animRef.current);
  }, [initGame, gameLoop]);

  // Resize
  useEffect(() => {
    const handleResize = () => {
      const { width, height } = getSize();
      setCanvasSize({ width, height });
      // On resize, reinit to recalculate brick positions
      if (stateRef.current && !stateRef.current.gameOver) {
        const oldS = stateRef.current;
        const score = oldS.score;
        const lives = oldS.lives;
        initGame();
        if (stateRef.current) {
          stateRef.current.score = score;
          stateRef.current.lives = lives;
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getSize, initGame]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        style={{
          display: 'block',
          borderRadius: '8px',
          border: '2px solid rgba(255, 255, 255, 0.15)',
          touchAction: 'none',
          maxWidth: '100%',
        }}
      />
    </div>
  );
}
