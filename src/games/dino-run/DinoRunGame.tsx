'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface Props {
  onGameOver: (score: number) => void;
  level: 'easy' | 'medium' | 'hard';
}

const CANVAS_W = 600;
const CANVAS_H = 200;
const GROUND_Y = 160;
const DINO_W = 40;
const DINO_H = 44;
const CACTUS_W = 20;
const CACTUS_H = 40;

// Difficulty-dependent constants are set in the component

// Dust particle type
type DustParticle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number };

// Parallax mountain layer
type Mountain = { x: number; width: number; height: number; layer: number };

export default function DinoRunGame({ onGameOver, level }: Props) {
  // Difficulty settings
  const GRAVITY = level === 'easy' ? 0.45 : level === 'hard' ? 0.7 : 0.6;
  const JUMP_FORCE = level === 'easy' ? -10 : level === 'hard' ? -12 : -11;
  const INITIAL_SPEED = level === 'easy' ? 3 : level === 'hard' ? 5.5 : 4;
  const MAX_SPEED = level === 'easy' ? 9 : level === 'hard' ? 14 : 12;
  const MIN_CACTUS_GAP = level === 'easy' ? 80 : level === 'hard' ? 35 : 50;
  const MAX_CACTUS_GAP = level === 'easy' ? 100 : level === 'hard' ? 45 : 60;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [started, setStarted] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const gameRef = useRef({
    dinoY: GROUND_Y - DINO_H,
    dinoVY: 0,
    isJumping: false,
    wasJumping: false,
    cacti: [] as { x: number; w: number; h: number }[],
    speed: INITIAL_SPEED,
    score: 0,
    frameId: 0,
    running: false,
    gameOverNotified: false,
    groundOffset: 0,
    nextCactusIn: 80,
    dustParticles: [] as DustParticle[],
    mountains: [] as Mountain[],
    mountainsInited: false,
    starField: [] as { x: number; y: number; brightness: number; twinkleSpeed: number }[],
    starsInited: false,
  });

  const jump = useCallback(() => {
    const g = gameRef.current;
    if (!g.running) return;
    if (!g.isJumping) {
      g.dinoVY = JUMP_FORCE;
      g.isJumping = true;
    }
  }, [JUMP_FORCE]);

  const startGame = useCallback(() => {
    const g = gameRef.current;
    g.dinoY = GROUND_Y - DINO_H;
    g.dinoVY = 0;
    g.isJumping = false;
    g.wasJumping = false;
    g.cacti = [];
    g.speed = INITIAL_SPEED;
    g.score = 0;
    g.running = true;
    g.gameOverNotified = false;
    g.groundOffset = 0;
    g.nextCactusIn = MIN_CACTUS_GAP + Math.floor(Math.random() * MAX_CACTUS_GAP);
    g.dustParticles = [];
    setStarted(true);
    setDisplayScore(0);
  }, [INITIAL_SPEED, MIN_CACTUS_GAP, MAX_CACTUS_GAP]);

  // Input handlers
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (!started) startGame();
        else jump();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [started, jump, startGame]);

  const handleTap = useCallback(() => {
    if (!started) startGame();
    else jump();
  }, [started, jump, startGame]);

  // Touch / click on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      handleTap();
    };
    const handleClick = () => {
      handleTap();
    };
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('click', handleClick);
    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('click', handleClick);
    };
  }, [handleTap]);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // Initialize stars once
    const g0 = gameRef.current;
    if (!g0.starsInited) {
      g0.starsInited = true;
      g0.starField = Array.from({ length: 30 }, () => ({
        x: Math.random() * CANVAS_W,
        y: Math.random() * (GROUND_Y - 40),
        brightness: 0.2 + Math.random() * 0.5,
        twinkleSpeed: 0.02 + Math.random() * 0.04,
      }));
    }
    // Initialize mountains once
    if (!g0.mountainsInited) {
      g0.mountainsInited = true;
      const mts: Mountain[] = [];
      // Far layer
      for (let i = 0; i < 8; i++) {
        mts.push({ x: i * 100 - 50, width: 80 + Math.random() * 60, height: 30 + Math.random() * 25, layer: 0 });
      }
      // Near layer
      for (let i = 0; i < 6; i++) {
        mts.push({ x: i * 130 - 30, width: 90 + Math.random() * 50, height: 20 + Math.random() * 20, layer: 1 });
      }
      g0.mountains = mts;
    }

    const spawnDust = (x: number, y: number, count: number) => {
      const g = gameRef.current;
      for (let i = 0; i < count; i++) {
        g.dustParticles.push({
          x: x + Math.random() * 20,
          y: y + Math.random() * 4,
          vx: -(1 + Math.random() * 2),
          vy: -(0.5 + Math.random() * 1.5),
          life: 15 + Math.random() * 15,
          maxLife: 30,
          size: 1.5 + Math.random() * 2.5,
        });
      }
    };

    const drawBackground = () => {
      const g = gameRef.current;
      // Dark sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      skyGrad.addColorStop(0, '#050510');
      skyGrad.addColorStop(0.5, '#0a0a20');
      skyGrad.addColorStop(1, '#10102a');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Twinkling stars
      const t = Date.now() * 0.001;
      for (const star of g.starField) {
        const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(t * star.twinkleSpeed * 10 + star.x));
        const alpha = star.brightness * twinkle;
        ctx.fillStyle = `rgba(180, 200, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, 1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Parallax mountains
      const farSpeed = g.running ? g.speed * 0.15 : 0;
      const nearSpeed = g.running ? g.speed * 0.3 : 0;
      for (const m of g.mountains) {
        const speed = m.layer === 0 ? farSpeed : nearSpeed;
        if (g.running) m.x -= speed;
        // Wrap
        if (m.x + m.width < -20) m.x += CANVAS_W + m.width + 40;

        const baseY = GROUND_Y;
        const alpha = m.layer === 0 ? 0.15 : 0.25;
        const color = m.layer === 0 ? `rgba(40, 50, 100, ${alpha})` : `rgba(30, 40, 80, ${alpha})`;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(m.x, baseY);
        ctx.quadraticCurveTo(m.x + m.width * 0.3, baseY - m.height * 1.2, m.x + m.width * 0.5, baseY - m.height);
        ctx.quadraticCurveTo(m.x + m.width * 0.7, baseY - m.height * 0.8, m.x + m.width, baseY);
        ctx.closePath();
        ctx.fill();
      }
    };

    const drawGround = () => {
      const g = gameRef.current;

      // Ground gradient line
      const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, CANVAS_H);
      groundGrad.addColorStop(0, '#00ffcc');
      groundGrad.addColorStop(0.05, '#00aa88');
      groundGrad.addColorStop(0.4, '#0a1a15');
      groundGrad.addColorStop(1, '#050510');
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y);

      // Neon ground line with glow
      ctx.shadowColor = '#00ffcc';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#00ffcc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      ctx.lineTo(CANVAS_W, GROUND_Y);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Dashed ground detail
      ctx.strokeStyle = 'rgba(0, 255, 204, 0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(-g.groundOffset % 12, GROUND_Y + 10);
      ctx.lineTo(CANVAS_W, GROUND_Y + 10);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const drawDino = (x: number, y: number) => {
      const g = gameRef.current;
      const time = Date.now();

      // Squash/stretch
      let scaleX = 1;
      let scaleY = 1;
      if (g.isJumping) {
        if (g.dinoVY < -5) { scaleX = 0.85; scaleY = 1.15; }
        else if (g.dinoVY > 5) { scaleX = 1.15; scaleY = 0.85; }
      }

      ctx.save();
      const cx = x + DINO_W / 2;
      const cy = y + DINO_H / 2;
      ctx.translate(cx, cy);
      ctx.scale(scaleX, scaleY);
      ctx.translate(-cx, -cy);

      // Body gradient
      const bodyGrad = ctx.createLinearGradient(x, y, x, y + DINO_H);
      bodyGrad.addColorStop(0, '#6ee7b7');
      bodyGrad.addColorStop(0.5, '#34d399');
      bodyGrad.addColorStop(1, '#059669');
      ctx.fillStyle = bodyGrad;

      // Smooth body
      ctx.beginPath();
      ctx.ellipse(x + 20, y + 14, 14, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head
      const headGrad = ctx.createRadialGradient(x + 28, y - 2, 2, x + 28, y - 2, 14);
      headGrad.addColorStop(0, '#6ee7b7');
      headGrad.addColorStop(1, '#34d399');
      ctx.fillStyle = headGrad;
      ctx.beginPath();
      ctx.ellipse(x + 28, y - 2, 13, 10, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // Snout
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.ellipse(x + 38, y - 1, 5, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eye (expressive)
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(x + 32, y - 6, 4, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Pupil
      ctx.fillStyle = '#111';
      const pupilOffsetX = g.isJumping ? 1 : 0;
      ctx.beginPath();
      ctx.ellipse(x + 33 + pupilOffsetX, y - 5.5, 2, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Eye highlight
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(x + 31.5, y - 7.5, 1.2, 0, Math.PI * 2);
      ctx.fill();

      // Tail
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + 6, y + 10);
      ctx.quadraticCurveTo(x - 4, y + 5, x - 2, y - 2);
      ctx.stroke();

      // Legs (animated)
      ctx.fillStyle = '#059669';
      const legAnim = Math.floor(time / 80) % 2;
      const legY = y + 26;
      if (g.isJumping) {
        // Legs tucked
        ctx.beginPath();
        ctx.ellipse(x + 12, legY - 2, 5, 4, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + 26, legY - 2, 5, 4, -0.3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Running legs
        const offset1 = legAnim === 0 ? 6 : 0;
        const offset2 = legAnim === 0 ? 0 : 6;
        // Left leg
        ctx.beginPath();
        ctx.roundRect(x + 10, legY - offset1, 6, 10 + offset1, 3);
        ctx.fill();
        // Right leg
        ctx.beginPath();
        ctx.roundRect(x + 24, legY - offset2, 6, 10 + offset2, 3);
        ctx.fill();
        // Feet
        ctx.fillStyle = '#047857';
        ctx.beginPath();
        ctx.ellipse(x + 13, legY + 10, 4, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + 27, legY + 10, 4, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Arm
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.ellipse(x + 30, y + 14, 3, 6, 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Subtle body glow
      ctx.shadowColor = '#34d399';
      ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(52, 211, 153, 0.05)';
      ctx.beginPath();
      ctx.ellipse(x + 20, y + 12, 20, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.restore();
    };

    const drawCactus = (x: number, h: number, w: number) => {
      // Main trunk with gradient
      const trunkX = x + w / 2 - 5;
      const trunkGrad = ctx.createLinearGradient(trunkX, GROUND_Y - h, trunkX + 10, GROUND_Y);
      trunkGrad.addColorStop(0, '#22c55e');
      trunkGrad.addColorStop(0.5, '#16a34a');
      trunkGrad.addColorStop(1, '#15803d');

      ctx.fillStyle = trunkGrad;

      // Smooth trunk
      ctx.beginPath();
      ctx.roundRect(trunkX, GROUND_Y - h, 10, h, [5, 5, 2, 2]);
      ctx.fill();

      // Arms
      if (h > 30) {
        // Left arm
        ctx.beginPath();
        ctx.moveTo(trunkX, GROUND_Y - h + 14);
        ctx.quadraticCurveTo(x - 2, GROUND_Y - h + 10, x + 2, GROUND_Y - h + 24);
        ctx.lineTo(x + 2, GROUND_Y - h + 30);
        ctx.quadraticCurveTo(x + 2, GROUND_Y - h + 34, x + 6, GROUND_Y - h + 30);
        ctx.lineTo(trunkX + 2, GROUND_Y - h + 18);
        ctx.closePath();
        ctx.fill();

        // Right arm
        ctx.beginPath();
        ctx.moveTo(trunkX + 10, GROUND_Y - h + 10);
        ctx.quadraticCurveTo(x + w + 2, GROUND_Y - h + 6, x + w - 2, GROUND_Y - h + 20);
        ctx.lineTo(x + w - 2, GROUND_Y - h + 24);
        ctx.quadraticCurveTo(x + w - 2, GROUND_Y - h + 28, x + w - 6, GROUND_Y - h + 24);
        ctx.lineTo(trunkX + 8, GROUND_Y - h + 14);
        ctx.closePath();
        ctx.fill();
      }

      // Subtle neon glow
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 6;
      ctx.fillStyle = 'rgba(34, 197, 94, 0.08)';
      ctx.beginPath();
      ctx.ellipse(x + w / 2, GROUND_Y - h / 2, w * 0.8, h * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    const drawDustParticles = () => {
      const g = gameRef.current;
      for (const p of g.dustParticles) {
        const alpha = (p.life / p.maxLife) * 0.6;
        ctx.fillStyle = `rgba(200, 220, 210, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = () => {
      const g = gameRef.current;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      drawBackground();

      if (!g.running) {
        drawGround();
        drawDino(50, GROUND_Y - DINO_H);

        // Neon title
        ctx.shadowColor = '#00ffcc';
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#00ffcc';
        ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TAP TO START', CANVAS_W / 2, CANVAS_H / 2 - 20);
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'rgba(0, 255, 204, 0.5)';
        ctx.font = '12px "Segoe UI", system-ui, sans-serif';
        ctx.fillText('Space / Tap to jump', CANVAS_W / 2, CANVAS_H / 2 + 5);

        g.frameId = requestAnimationFrame(loop);
        return;
      }

      // Physics
      g.dinoVY += GRAVITY;
      g.dinoY += g.dinoVY;
      if (g.dinoY >= GROUND_Y - DINO_H) {
        g.dinoY = GROUND_Y - DINO_H;
        // Landing dust
        if (g.wasJumping && !g.isJumping) {
          // Already landed
        }
        if (g.isJumping) {
          spawnDust(50, GROUND_Y - 4, 6);
        }
        g.dinoVY = 0;
        g.isJumping = false;
      }
      // Track previous jump state for landing detection
      g.wasJumping = g.isJumping;

      // Running dust
      if (!g.isJumping && g.score % 4 === 0) {
        spawnDust(55, GROUND_Y - 2, 1);
      }

      // Update dust particles
      g.dustParticles = g.dustParticles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.life--;
        return p.life > 0;
      });

      // Ground scroll
      g.groundOffset += g.speed;

      // Spawn cacti
      g.nextCactusIn--;
      if (g.nextCactusIn <= 0) {
        const h = 28 + Math.random() * 20;
        const w = 14 + Math.random() * 14;
        g.cacti.push({ x: CANVAS_W + 10, w, h });
        g.nextCactusIn = MIN_CACTUS_GAP + Math.floor(Math.random() * MAX_CACTUS_GAP);
      }

      // Move cacti
      for (const c of g.cacti) {
        c.x -= g.speed;
      }
      g.cacti = g.cacti.filter((c) => c.x + c.w > -20);

      // Collision detection
      const dinoLeft = 50 + 8;
      const dinoRight = 50 + DINO_W - 4;
      const dinoTop = g.dinoY;
      const dinoBottom = g.dinoY + DINO_H + 12;

      for (const c of g.cacti) {
        const cLeft = c.x + c.w / 2 - 4;
        const cRight = c.x + c.w / 2 + 4;
        const cTop = GROUND_Y - c.h;

        if (dinoRight > cLeft && dinoLeft < cRight && dinoBottom > cTop) {
          // Hit!
          g.running = false;
          if (!g.gameOverNotified) {
            g.gameOverNotified = true;
            setTimeout(() => {
              setStarted(false);
              onGameOver(g.score);
            }, 2500);
          }
          // Draw the crash frame
          drawGround();
          drawDustParticles();
          for (const cc of g.cacti) {
            drawCactus(cc.x, cc.h, cc.w);
          }
          drawDino(50, g.dinoY);
          // Game over overlay
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

          ctx.shadowColor = '#ff4444';
          ctx.shadowBlur = 20;
          ctx.fillStyle = '#ff4444';
          ctx.font = 'bold 28px "Segoe UI", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('GAME OVER', CANVAS_W / 2, CANVAS_H / 2 - 10);
          ctx.shadowBlur = 0;

          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
          ctx.fillText(`Score: ${g.score}`, CANVAS_W / 2, CANVAS_H / 2 + 20);
          return;
        }
      }

      // Score
      g.score++;
      if (g.score % 5 === 0) {
        setDisplayScore(g.score);
      }

      // Speed up
      g.speed = Math.min(INITIAL_SPEED + g.score * 0.005, MAX_SPEED);

      // Draw
      drawGround();
      drawDustParticles();
      for (const c of g.cacti) {
        drawCactus(c.x, c.h, c.w);
      }
      drawDino(50, g.dinoY);

      // HUD with glow
      ctx.shadowColor = '#00ffcc';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#00ffcc';
      ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${g.score}`, CANVAS_W - 14, 26);
      ctx.shadowBlur = 0;

      ctx.fillStyle = 'rgba(0, 255, 204, 0.5)';
      ctx.font = '10px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('SCORE', CANVAS_W - 14, 14);

      g.frameId = requestAnimationFrame(loop);
    };

    gameRef.current.frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameRef.current.frameId);
  }, [started, onGameOver]);

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <div className="text-sm font-semibold text-zinc-400">
        Score: <span className="text-white">{displayScore}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="rounded-xl border border-zinc-700 cursor-pointer max-w-full"
        style={{ touchAction: 'none' }}
      />
      <p className="text-xs text-zinc-600">Space / Tap to jump</p>
    </div>
  );
}
