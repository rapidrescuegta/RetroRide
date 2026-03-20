'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface BrickBreakerGameProps {
  onGameOver: (score: number) => void;
}

const W = 380;
const H = 520;
const PADDLE_W = 70;
const PADDLE_H = 12;
const BALL_R = 6;
const BRICK_ROWS = 6;
const BRICK_COLS = 8;
const BRICK_W = (W - 20) / BRICK_COLS;
const BRICK_H = 18;
const BRICK_PAD = 2;

interface Brick {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  color: string;
  alive: boolean;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: { x: number; y: number }[];
}

interface PowerUp {
  x: number;
  y: number;
  type: 'wide' | 'multi' | 'life';
  vy: number;
}

const BRICK_COLORS: Record<number, string[]> = {
  1: ['#ff4444', '#ff8844', '#ffcc44', '#44ff44', '#44aaff', '#ff44ff'],
  2: ['#888', '#999'],
  3: ['#ffd700'],
};

export default function BrickBreakerGame({ onGameOver }: BrickBreakerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    paddleX: number;
    balls: Ball[];
    bricks: Brick[];
    powerUps: PowerUp[];
    score: number;
    lives: number;
    level: number;
    gameOver: boolean;
    launched: boolean;
    wideTimer: number;
    paddleW: number;
    frameCount: number;
    touchX: number | null;
    particles: { x: number; y: number; vx: number; vy: number; life: number; color: string }[];
  } | null>(null);
  const animRef = useRef(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [gameOverCalled, setGameOverCalled] = useState(false);
  const finalScoreRef = useRef(0);
  const keysRef = useRef<Set<string>>(new Set());

  const createBricks = useCallback((lvl: number): Brick[] => {
    const bricks: Brick[] = [];
    const rows = Math.min(BRICK_ROWS + Math.floor(lvl / 2), 9);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        let hp = 1;
        let color = BRICK_COLORS[1][r % 6];

        // Add tough bricks
        if (lvl >= 2 && r < 2 && Math.random() < 0.3 + lvl * 0.05) {
          hp = 2;
          color = BRICK_COLORS[2][Math.floor(Math.random() * 2)];
        }
        // Gold bricks
        if (lvl >= 3 && Math.random() < 0.1) {
          hp = 3;
          color = BRICK_COLORS[3][0];
        }

        bricks.push({
          x: 10 + c * BRICK_W + BRICK_PAD,
          y: 40 + r * (BRICK_H + BRICK_PAD),
          hp,
          maxHp: hp,
          color,
          alive: true,
        });
      }
    }
    return bricks;
  }, []);

  const initGame = useCallback(() => {
    const ball: Ball = {
      x: W / 2,
      y: H - 50,
      vx: 0,
      vy: 0,
      trail: [],
    };

    stateRef.current = {
      paddleX: W / 2,
      balls: [ball],
      bricks: createBricks(1),
      powerUps: [],
      score: 0,
      lives: 3,
      level: 1,
      gameOver: false,
      launched: false,
      wideTimer: 0,
      paddleW: PADDLE_W,
      frameCount: 0,
      touchX: null,
      particles: [],
    };
    setScore(0);
    setLives(3);
    setLevel(1);
    setGameOver(false);
    setGameOverCalled(false);
  }, [createBricks]);

  useEffect(() => { initGame(); }, [initGame]);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => { keysRef.current.delete(e.key); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // Touch
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      const gs = stateRef.current;
      if (!gs) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      gs.touchX = (e.touches[0].clientX - rect.left) * scaleX;

      if (!gs.launched) {
        gs.launched = true;
        gs.balls[0].vx = 3;
        gs.balls[0].vy = -5;
      }
    };
    const handleEnd = (e: TouchEvent) => {
      e.preventDefault();
      const gs = stateRef.current;
      if (gs) gs.touchX = null;
    };

    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    canvas.addEventListener('touchend', handleEnd, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', handleTouch);
      canvas.removeEventListener('touchmove', handleTouch);
      canvas.removeEventListener('touchend', handleEnd);
    };
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      const gs = stateRef.current;
      if (!gs) return;

      gs.frameCount++;

      // Dark background with subtle radial gradient
      const bgGrad = ctx.createRadialGradient(W / 2, H / 3, 30, W / 2, H / 2, W);
      bgGrad.addColorStop(0, '#0c0c28');
      bgGrad.addColorStop(1, '#040410');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Subtle grid pattern
      ctx.strokeStyle = 'rgba(40,40,80,0.15)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < W; x += 20) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 20) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      // Subtle grid dots at intersections
      ctx.fillStyle = 'rgba(60,60,120,0.15)';
      for (let x = 0; x < W; x += 20) {
        for (let y = 0; y < H; y += 20) {
          ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
        }
      }

      if (!gs.gameOver) {
        // Paddle input
        const keys = keysRef.current;
        const speed = 7;
        if (keys.has('ArrowLeft') || keys.has('a')) gs.paddleX -= speed;
        if (keys.has('ArrowRight') || keys.has('d')) gs.paddleX += speed;
        if (keys.has(' ') && !gs.launched) {
          gs.launched = true;
          gs.balls[0].vx = 3;
          gs.balls[0].vy = -5;
        }

        if (gs.touchX !== null) {
          const diff = gs.touchX - gs.paddleX;
          gs.paddleX += Math.sign(diff) * Math.min(Math.abs(diff), speed + 2);
        }

        gs.paddleX = Math.max(gs.paddleW / 2, Math.min(W - gs.paddleW / 2, gs.paddleX));

        // Wide paddle timer
        if (gs.wideTimer > 0) {
          gs.wideTimer--;
          if (gs.wideTimer === 0) gs.paddleW = PADDLE_W;
        }

        // Ball on paddle before launch
        if (!gs.launched) {
          gs.balls[0].x = gs.paddleX;
          gs.balls[0].y = H - 40 - PADDLE_H / 2 - BALL_R;
        }

        // Move balls
        const ballsToRemove: number[] = [];
        gs.balls.forEach((ball, idx) => {
          if (!gs.launched) return;

          // Trail
          ball.trail.push({ x: ball.x, y: ball.y });
          if (ball.trail.length > 8) ball.trail.shift();

          ball.x += ball.vx;
          ball.y += ball.vy;

          // Wall bounces
          if (ball.x - BALL_R < 0) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); }
          if (ball.x + BALL_R > W) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx); }
          if (ball.y - BALL_R < 0) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); }

          // Paddle collision
          const paddleTop = H - 40;
          if (ball.vy > 0 && ball.y + BALL_R >= paddleTop && ball.y + BALL_R <= paddleTop + PADDLE_H + 4) {
            if (ball.x >= gs.paddleX - gs.paddleW / 2 - 2 && ball.x <= gs.paddleX + gs.paddleW / 2 + 2) {
              ball.y = paddleTop - BALL_R;
              // Angle based on hit position
              const hitPos = (ball.x - gs.paddleX) / (gs.paddleW / 2);
              ball.vx = hitPos * 5;
              ball.vy = -Math.sqrt(25 - ball.vx * ball.vx);
              if (ball.vy > -2) ball.vy = -2;
            }
          }

          // Brick collision
          gs.bricks.forEach(brick => {
            if (!brick.alive) return;
            const bx = brick.x, by = brick.y;
            const bw = BRICK_W - BRICK_PAD * 2, bh = BRICK_H;

            if (ball.x + BALL_R > bx && ball.x - BALL_R < bx + bw &&
                ball.y + BALL_R > by && ball.y - BALL_R < by + bh) {
              brick.hp--;
              if (brick.hp <= 0) {
                brick.alive = false;
                const pts = brick.maxHp === 3 ? 50 : brick.maxHp === 2 ? 25 : 10;
                gs.score += pts;
                setScore(gs.score);

                // Particles - more for visual impact
                for (let i = 0; i < 12; i++) {
                  gs.particles.push({
                    x: bx + bw / 2,
                    y: by + bh / 2,
                    vx: (Math.random() - 0.5) * 6,
                    vy: (Math.random() - 0.5) * 6,
                    life: 20 + Math.random() * 15,
                    color: brick.color,
                  });
                }

                // Power-up drop
                if (Math.random() < 0.2) {
                  const types: PowerUp['type'][] = ['wide', 'multi', 'life'];
                  gs.powerUps.push({
                    x: bx + bw / 2,
                    y: by + bh / 2,
                    type: types[Math.floor(Math.random() * types.length)],
                    vy: 2,
                  });
                }
              } else {
                // Update color for damaged bricks
                if (brick.maxHp === 3 && brick.hp === 2) brick.color = '#ccaa00';
                if (brick.maxHp === 3 && brick.hp === 1) brick.color = '#aa7700';
                if (brick.maxHp === 2 && brick.hp === 1) brick.color = '#666';
              }

              // Bounce
              const overlapX = Math.min(ball.x + BALL_R - bx, bx + bw - (ball.x - BALL_R));
              const overlapY = Math.min(ball.y + BALL_R - by, by + bh - (ball.y - BALL_R));
              if (overlapX < overlapY) ball.vx = -ball.vx;
              else ball.vy = -ball.vy;
            }
          });

          // Ball lost
          if (ball.y - BALL_R > H) {
            ballsToRemove.push(idx);
          }
        });

        // Remove lost balls
        for (let i = ballsToRemove.length - 1; i >= 0; i--) {
          gs.balls.splice(ballsToRemove[i], 1);
        }

        if (gs.balls.length === 0) {
          gs.lives--;
          setLives(gs.lives);
          if (gs.lives <= 0) {
            gs.gameOver = true;
            finalScoreRef.current = gs.score;
            setGameOver(true);
          } else {
            gs.launched = false;
            gs.balls = [{
              x: gs.paddleX,
              y: H - 40 - PADDLE_H / 2 - BALL_R,
              vx: 0, vy: 0, trail: [],
            }];
            gs.paddleW = PADDLE_W;
            gs.wideTimer = 0;
          }
        }

        // Power-ups
        gs.powerUps = gs.powerUps.filter(pu => {
          pu.y += pu.vy;
          // Collect
          if (pu.y + 8 >= H - 40 && pu.y - 8 <= H - 40 + PADDLE_H) {
            if (pu.x >= gs.paddleX - gs.paddleW / 2 && pu.x <= gs.paddleX + gs.paddleW / 2) {
              if (pu.type === 'wide') {
                gs.paddleW = PADDLE_W * 1.6;
                gs.wideTimer = 600; // 10 seconds
              } else if (pu.type === 'multi') {
                const newBalls: Ball[] = [];
                gs.balls.forEach(b => {
                  newBalls.push({
                    x: b.x, y: b.y,
                    vx: b.vx + 2, vy: b.vy,
                    trail: [],
                  });
                  newBalls.push({
                    x: b.x, y: b.y,
                    vx: b.vx - 2, vy: b.vy,
                    trail: [],
                  });
                });
                gs.balls.push(...newBalls);
              } else if (pu.type === 'life') {
                gs.lives = Math.min(gs.lives + 1, 5);
                setLives(gs.lives);
              }
              return false;
            }
          }
          return pu.y < H + 20;
        });

        // Level complete
        if (gs.bricks.every(b => !b.alive)) {
          gs.level++;
          setLevel(gs.level);
          gs.bricks = createBricks(gs.level);
          gs.launched = false;
          gs.balls = [{
            x: gs.paddleX,
            y: H - 40 - PADDLE_H / 2 - BALL_R,
            vx: 0, vy: 0, trail: [],
          }];
          gs.powerUps = [];
          gs.paddleW = PADDLE_W;
          gs.wideTimer = 0;
        }
      }

      // Draw particles with glow
      gs.particles = gs.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // gravity
        p.life--;
        const alpha = p.life / 35;
        ctx.globalAlpha = alpha;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 + alpha * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        return p.life > 0;
      });

      // Draw bricks with rounded corners, glossy gradient, and special effects
      gs.bricks.forEach(brick => {
        if (!brick.alive) return;
        const bw = BRICK_W - BRICK_PAD * 2;
        const bx = brick.x;
        const by = brick.y;
        const cornerR = 3;

        if (brick.maxHp === 3) {
          // GOLD bricks: golden gradient with sparkle
          const goldGrad = ctx.createLinearGradient(bx, by, bx + bw, by + BRICK_H);
          goldGrad.addColorStop(0, '#ffee88');
          goldGrad.addColorStop(0.3, '#ffd700');
          goldGrad.addColorStop(0.5, '#ffee88');
          goldGrad.addColorStop(0.7, '#cc9900');
          goldGrad.addColorStop(1, '#aa7700');
          ctx.fillStyle = goldGrad;
          ctx.shadowColor = '#ffcc00';
          ctx.shadowBlur = brick.hp === 3 ? 8 : 4;
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, BRICK_H, cornerR);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Sparkle effect for full-hp gold
          if (brick.hp === 3) {
            const sparklePhase = gs.frameCount * 0.05 + bx * 0.1;
            const sx = bx + (Math.sin(sparklePhase) * 0.5 + 0.5) * bw;
            const sy = by + (Math.cos(sparklePhase * 1.3) * 0.5 + 0.5) * BRICK_H;
            ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(sparklePhase * 3) * 0.3})`;
            ctx.beginPath();
            ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }

          // Crack overlay for damaged gold
          if (brick.hp < brick.maxHp) {
            ctx.strokeStyle = `rgba(80,50,0,${0.3 + (brick.maxHp - brick.hp) * 0.2})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(bx + bw * 0.3, by);
            ctx.lineTo(bx + bw * 0.45, by + BRICK_H * 0.6);
            ctx.lineTo(bx + bw * 0.55, by + BRICK_H);
            ctx.stroke();
            if (brick.hp === 1) {
              ctx.beginPath();
              ctx.moveTo(bx + bw * 0.7, by);
              ctx.lineTo(bx + bw * 0.6, by + BRICK_H * 0.5);
              ctx.lineTo(bx + bw * 0.45, by + BRICK_H * 0.6);
              ctx.stroke();
            }
          }
        } else if (brick.maxHp === 2) {
          // TOUGH bricks: metallic silver gradient
          const silverGrad = ctx.createLinearGradient(bx, by, bx + bw, by + BRICK_H);
          silverGrad.addColorStop(0, '#ddd');
          silverGrad.addColorStop(0.3, '#aaa');
          silverGrad.addColorStop(0.5, '#ccc');
          silverGrad.addColorStop(0.7, '#888');
          silverGrad.addColorStop(1, '#666');
          ctx.fillStyle = silverGrad;
          ctx.shadowColor = '#aaaacc';
          ctx.shadowBlur = 4;
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, BRICK_H, cornerR);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Crack overlay when damaged
          if (brick.hp < brick.maxHp) {
            ctx.strokeStyle = 'rgba(30,30,30,0.5)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(bx + bw * 0.35, by + 1);
            ctx.lineTo(bx + bw * 0.5, by + BRICK_H * 0.5);
            ctx.lineTo(bx + bw * 0.4, by + BRICK_H - 1);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(bx + bw * 0.5, by + BRICK_H * 0.5);
            ctx.lineTo(bx + bw * 0.65, by + BRICK_H * 0.7);
            ctx.stroke();
          }
        } else {
          // NORMAL bricks: vibrant gradient with subtle glow
          // Parse brick color to create gradient
          const baseColor = brick.color;
          ctx.shadowColor = baseColor;
          ctx.shadowBlur = 5;

          const normGrad = ctx.createLinearGradient(bx, by, bx, by + BRICK_H);
          normGrad.addColorStop(0, baseColor);
          normGrad.addColorStop(1, baseColor);
          ctx.fillStyle = normGrad;
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, BRICK_H, cornerR);
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // Glossy shine overlay for all bricks
        const shineGrad = ctx.createLinearGradient(bx, by, bx, by + BRICK_H);
        shineGrad.addColorStop(0, 'rgba(255,255,255,0.35)');
        shineGrad.addColorStop(0.4, 'rgba(255,255,255,0.08)');
        shineGrad.addColorStop(0.5, 'rgba(0,0,0,0)');
        shineGrad.addColorStop(1, 'rgba(0,0,0,0.15)');
        ctx.fillStyle = shineGrad;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, BRICK_H, cornerR);
        ctx.fill();

        // Thin highlight border
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.roundRect(bx + 0.5, by + 0.5, bw - 1, BRICK_H - 1, cornerR);
        ctx.stroke();
      });

      // Draw paddle with rounded neon glow + metallic gradient
      const paddleTop = H - 40;
      const paddleL = gs.paddleX - gs.paddleW / 2;

      // Paddle glow
      ctx.shadowColor = '#4488ff';
      ctx.shadowBlur = 16;

      const paddleGrad = ctx.createLinearGradient(paddleL, paddleTop, paddleL + gs.paddleW, paddleTop + PADDLE_H);
      paddleGrad.addColorStop(0, '#88bbff');
      paddleGrad.addColorStop(0.3, '#4488ee');
      paddleGrad.addColorStop(0.5, '#6699ff');
      paddleGrad.addColorStop(0.7, '#3366cc');
      paddleGrad.addColorStop(1, '#2244aa');
      ctx.fillStyle = paddleGrad;
      ctx.beginPath();
      ctx.roundRect(paddleL, paddleTop, gs.paddleW, PADDLE_H, 6);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Paddle top shine
      const paddleShine = ctx.createLinearGradient(paddleL, paddleTop, paddleL, paddleTop + PADDLE_H / 2);
      paddleShine.addColorStop(0, 'rgba(255,255,255,0.4)');
      paddleShine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = paddleShine;
      ctx.beginPath();
      ctx.roundRect(paddleL + 2, paddleTop + 1, gs.paddleW - 4, PADDLE_H / 2, [4, 4, 0, 0]);
      ctx.fill();

      // Draw balls with bright glow and motion trail
      gs.balls.forEach(ball => {
        // Motion trail - fading circles
        ball.trail.forEach((t, i) => {
          const alpha = (i + 1) / ball.trail.length * 0.35;
          const r = BALL_R * 0.6 * (i + 1) / ball.trail.length;
          const trailGrad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, r + 2);
          trailGrad.addColorStop(0, `rgba(255,200,100,${alpha})`);
          trailGrad.addColorStop(1, `rgba(255,120,30,0)`);
          ctx.fillStyle = trailGrad;
          ctx.beginPath();
          ctx.arc(t.x, t.y, r + 2, 0, Math.PI * 2);
          ctx.fill();
        });

        // Ball outer glow
        ctx.shadowColor = '#ffaa44';
        ctx.shadowBlur = 14;

        // Ball with radial gradient
        const ballGrad = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 0, ball.x, ball.y, BALL_R);
        ballGrad.addColorStop(0, '#ffffff');
        ballGrad.addColorStop(0.3, '#ffeedd');
        ballGrad.addColorStop(0.7, '#ffaa44');
        ballGrad.addColorStop(1, '#dd6600');
        ctx.fillStyle = ballGrad;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Draw power-ups with glow and trail
      gs.powerUps.forEach(pu => {
        const colors: Record<string, string> = { wide: '#4488ff', multi: '#44ff44', life: '#ff4488' };
        const glowColors: Record<string, string> = { wide: '#2266dd', multi: '#22cc22', life: '#dd2266' };
        const labels: Record<string, string> = { wide: 'W', multi: 'M', life: '+' };
        const baseColor = colors[pu.type];
        const glowColor = glowColors[pu.type];

        // Falling trail
        ctx.fillStyle = `rgba(${pu.type === 'wide' ? '68,136,255' : pu.type === 'multi' ? '68,255,68' : '255,68,136'},0.15)`;
        ctx.beginPath();
        ctx.ellipse(pu.x, pu.y - 10, 6, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Glowing capsule
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 10;
        const puGrad = ctx.createLinearGradient(pu.x - 10, pu.y - 8, pu.x + 10, pu.y + 8);
        puGrad.addColorStop(0, baseColor);
        puGrad.addColorStop(1, glowColor);
        ctx.fillStyle = puGrad;
        ctx.beginPath();
        ctx.roundRect(pu.x - 10, pu.y - 8, 20, 16, 6);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Shine
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.roundRect(pu.x - 8, pu.y - 7, 16, 6, [4, 4, 0, 0]);
        ctx.fill();

        // Label
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labels[pu.type], pu.x, pu.y + 1);
      });

      // Lives display - glowing hearts
      for (let i = 0; i < gs.lives; i++) {
        ctx.shadowColor = '#ff2266';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#ff4488';
        ctx.font = '14px sans-serif';
        ctx.fillText('\u2665', 10 + i * 18, H - 8);
        ctx.shadowBlur = 0;
      }

      // Game over with neon glow
      if (gs.gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(0, H / 2 - 50, W, 100);
        ctx.shadowColor = '#ff2200';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GAME OVER', W / 2, H / 2 - 10);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '16px monospace';
        ctx.fillText(`Score: ${gs.score}`, W / 2, H / 2 + 20);
      }

      // Launch hint with pulsing glow
      if (!gs.launched && !gs.gameOver) {
        const hintAlpha = 0.5 + Math.sin(gs.frameCount * 0.08) * 0.3;
        ctx.shadowColor = `rgba(100,180,255,${hintAlpha})`;
        ctx.shadowBlur = 10;
        ctx.fillStyle = `rgba(200,230,255,${hintAlpha})`;
        ctx.font = '14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Tap or Space to launch', W / 2, H / 2);
        ctx.shadowBlur = 0;
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [createBricks]);

  useEffect(() => {
    if (gameOver && !gameOverCalled) {
      setGameOverCalled(true);
      const timer = setTimeout(() => onGameOver(finalScoreRef.current), 2500);
      return () => clearTimeout(timer);
    }
  }, [gameOver, gameOverCalled, onGameOver]);

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div className="flex justify-between w-full max-w-[400px] px-2 text-white font-mono text-sm">
        <span>Score: {score}</span>
        <span>Level: {level}</span>
        <span>Lives: {lives}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="rounded-lg border-2 border-blue-600 bg-black max-w-full touch-none"
      />
      <p className="text-xs text-gray-400 font-mono">Arrows/drag paddle, Space/tap to launch</p>
    </div>
  );
}
