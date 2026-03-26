'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { playSound } from '@/lib/audio';

interface PongGameProps {
  onGameOver: (score: number) => void;
  level: 'easy' | 'medium' | 'hard';
}

const LEVEL_CONFIG = {
  easy:   { winningScore: 5, ballSpeedRatio: 0.004, aiSpeedRatio: 0.0025, aiJitter: 20 },
  medium: { winningScore: 7, ballSpeedRatio: 0.006, aiSpeedRatio: 0.004,  aiJitter: 10 },
  hard:   { winningScore: 10, ballSpeedRatio: 0.008, aiSpeedRatio: 0.006, aiJitter: 3 },
} as const;

const PADDLE_WIDTH_RATIO = 0.02;
const PADDLE_HEIGHT_RATIO = 0.18;
const BALL_RADIUS_RATIO = 0.012;
const PADDLE_MARGIN_RATIO = 0.03;

export default function PongGame({ onGameOver, level }: PongGameProps) {
  const { winningScore: WINNING_SCORE, ballSpeedRatio: BALL_SPEED_RATIO, aiSpeedRatio: AI_SPEED_RATIO, aiJitter: AI_JITTER } = LEVEL_CONFIG[level];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    playerY: number;
    aiY: number;
    ballX: number;
    ballY: number;
    ballVX: number;
    ballVY: number;
    playerScore: number;
    aiScore: number;
    gameOver: boolean;
    gameOverNotified: boolean;
    paddleW: number;
    paddleH: number;
    ballR: number;
    margin: number;
    ballSpeed: number;
    aiSpeed: number;
    w: number;
    h: number;
    serving: boolean;
    serveTimer: number;
    particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string }>;
  } | null>(null);
  const animRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());
  const touchYRef = useRef<number | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 400 });

  const getSize = useCallback(() => {
    const maxW = Math.min(window.innerWidth - 32, 700);
    const maxH = Math.min(window.innerHeight - 120, 500);
    const aspect = 3 / 2;
    let w = maxW;
    let h = w / aspect;
    if (h > maxH) { h = maxH; w = h * aspect; }
    return { width: Math.floor(w), height: Math.floor(h) };
  }, []);

  const resetBall = useCallback((state: NonNullable<typeof stateRef.current>) => {
    state.ballX = state.w / 2;
    state.ballY = state.h / 2;
    const angle = (Math.random() - 0.5) * Math.PI * 0.5;
    const dir = Math.random() > 0.5 ? 1 : -1;
    state.ballVX = Math.cos(angle) * state.ballSpeed * dir;
    state.ballVY = Math.sin(angle) * state.ballSpeed;
    state.serving = true;
    state.serveTimer = 60;
  }, []);

  const initGame = useCallback(() => {
    const { width: w, height: h } = getSize();
    setCanvasSize({ width: w, height: h });
    const state = {
      playerY: h / 2,
      aiY: h / 2,
      ballX: w / 2,
      ballY: h / 2,
      ballVX: 0,
      ballVY: 0,
      playerScore: 0,
      aiScore: 0,
      gameOver: false,
      gameOverNotified: false,
      paddleW: Math.max(6, w * PADDLE_WIDTH_RATIO),
      paddleH: Math.max(40, h * PADDLE_HEIGHT_RATIO),
      ballR: Math.max(5, Math.min(w, h) * BALL_RADIUS_RATIO),
      margin: w * PADDLE_MARGIN_RATIO,
      ballSpeed: Math.max(3, w * BALL_SPEED_RATIO),
      aiSpeed: Math.max(2, h * AI_SPEED_RATIO),
      w, h,
      serving: true,
      serveTimer: 60,
      particles: [] as Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string }>,
    };
    stateRef.current = state;
    resetBall(state);
  }, [getSize, resetBall]);

  const spawnParticles = useCallback((x: number, y: number, color: string, count: number) => {
    const state = stateRef.current;
    if (!state) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 30 + Math.random() * 20,
        color,
      });
    }
  }, []);

  const ballTrailRef = useRef<Array<{ x: number; y: number; alpha: number }>>([]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const s = stateRef.current;
    if (!canvas || !s) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background with subtle gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, s.h);
    bgGrad.addColorStop(0, '#0c0c24');
    bgGrad.addColorStop(0.5, '#08081a');
    bgGrad.addColorStop(1, '#0c0c24');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, s.w, s.h);

    // Subtle vignette
    const vignetteGrad = ctx.createRadialGradient(
      s.w / 2, s.h / 2, s.h * 0.3,
      s.w / 2, s.h / 2, s.w * 0.8
    );
    vignetteGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignetteGrad.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, s.w, s.h);

    // Center line with glow
    ctx.save();
    ctx.setLineDash([10, 10]);
    ctx.shadowColor = 'rgba(100, 100, 255, 0.4)';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = 'rgba(100, 100, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s.w / 2, 0);
    ctx.lineTo(s.w / 2, s.h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Top and bottom edge glow lines
    const edgeGrad = ctx.createLinearGradient(0, 0, s.w, 0);
    edgeGrad.addColorStop(0, 'rgba(68, 136, 255, 0)');
    edgeGrad.addColorStop(0.5, 'rgba(68, 136, 255, 0.15)');
    edgeGrad.addColorStop(1, 'rgba(255, 68, 68, 0)');
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, 0, s.w, 1);
    ctx.fillRect(0, s.h - 1, s.w, 1);

    // Scores with glow
    const fontSize = Math.max(28, s.w * 0.07);
    ctx.font = `bold ${fontSize}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';

    // Player score (cyan glow)
    ctx.shadowColor = '#00ccff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = 'rgba(0, 204, 255, 0.35)';
    ctx.fillText(String(s.playerScore), s.w * 0.25, fontSize * 1.4);
    ctx.shadowBlur = 0;

    // AI score (pink glow)
    ctx.shadowColor = '#ff4488';
    ctx.shadowBlur = 20;
    ctx.fillStyle = 'rgba(255, 68, 136, 0.35)';
    ctx.fillText(String(s.aiScore), s.w * 0.75, fontSize * 1.4);
    ctx.shadowBlur = 0;

    // Labels
    ctx.font = `${Math.max(10, s.w * 0.018)}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(0, 204, 255, 0.25)';
    ctx.fillText('YOU', s.w * 0.25, fontSize * 1.4 + 18);
    ctx.fillStyle = 'rgba(255, 68, 136, 0.25)';
    ctx.fillText('CPU', s.w * 0.75, fontSize * 1.4 + 18);

    // Particles with glow
    s.particles.forEach(p => {
      const alpha = Math.max(0, p.life / 50);
      ctx.globalAlpha = alpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5 * alpha + 0.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Player paddle (left) with neon cyan glow and gradient
    const playerPaddleX = s.margin;
    const playerPaddleY = s.playerY - s.paddleH / 2;
    const playerGrad = ctx.createLinearGradient(playerPaddleX, playerPaddleY, playerPaddleX, playerPaddleY + s.paddleH);
    playerGrad.addColorStop(0, '#00eeff');
    playerGrad.addColorStop(0.5, '#00bbdd');
    playerGrad.addColorStop(1, '#0088aa');
    ctx.shadowColor = '#00ccff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = playerGrad;
    ctx.beginPath();
    ctx.roundRect(playerPaddleX, playerPaddleY, s.paddleW, s.paddleH, s.paddleW / 2);
    ctx.fill();
    // Inner highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.roundRect(playerPaddleX + 1, playerPaddleY + 2, s.paddleW - 2, s.paddleH * 0.3, s.paddleW / 2);
    ctx.fill();

    // AI paddle (right) with neon pink glow and gradient
    const aiPaddleX = s.w - s.margin - s.paddleW;
    const aiPaddleY = s.aiY - s.paddleH / 2;
    const aiGrad = ctx.createLinearGradient(aiPaddleX, aiPaddleY, aiPaddleX, aiPaddleY + s.paddleH);
    aiGrad.addColorStop(0, '#ff44aa');
    aiGrad.addColorStop(0.5, '#dd2288');
    aiGrad.addColorStop(1, '#aa1166');
    ctx.shadowColor = '#ff4488';
    ctx.shadowBlur = 20;
    ctx.fillStyle = aiGrad;
    ctx.beginPath();
    ctx.roundRect(aiPaddleX, aiPaddleY, s.paddleW, s.paddleH, s.paddleW / 2);
    ctx.fill();
    // Inner highlight
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.roundRect(aiPaddleX + 1, aiPaddleY + 2, s.paddleW - 2, s.paddleH * 0.3, s.paddleW / 2);
    ctx.fill();

    // Ball trail (comet effect)
    if (!s.serving) {
      ballTrailRef.current.push({ x: s.ballX, y: s.ballY, alpha: 1 });
      ballTrailRef.current = ballTrailRef.current
        .map(t => ({ ...t, alpha: t.alpha - 0.08 }))
        .filter(t => t.alpha > 0);

      // Draw trail
      ballTrailRef.current.forEach(t => {
        const trailGrad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, s.ballR * 2);
        trailGrad.addColorStop(0, `rgba(255, 255, 255, ${t.alpha * 0.3})`);
        trailGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = trailGrad;
        ctx.fillRect(t.x - s.ballR * 2, t.y - s.ballR * 2, s.ballR * 4, s.ballR * 4);
      });

      // Main ball with bright glow
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 25;
      const ballGrad = ctx.createRadialGradient(
        s.ballX - s.ballR * 0.2, s.ballY - s.ballR * 0.2, 0,
        s.ballX, s.ballY, s.ballR
      );
      ballGrad.addColorStop(0, '#ffffff');
      ballGrad.addColorStop(0.7, '#ddddff');
      ballGrad.addColorStop(1, '#aaaaff');
      ctx.fillStyle = ballGrad;
      ctx.beginPath();
      ctx.arc(s.ballX, s.ballY, s.ballR, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      // Blinking ball during serve with glow
      if (Math.floor(s.serveTimer / 8) % 2 === 0) {
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 10;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(s.ballX, s.ballY, s.ballR, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      // Clear trail on serve
      ballTrailRef.current = [];
    }

    // Game over overlay
    if (s.gameOver) {
      const overlayGrad = ctx.createRadialGradient(
        s.w / 2, s.h / 2, 0,
        s.w / 2, s.h / 2, s.w * 0.6
      );
      overlayGrad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
      overlayGrad.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
      ctx.fillStyle = overlayGrad;
      ctx.fillRect(0, 0, s.w, s.h);

      const won = s.playerScore >= WINNING_SCORE;
      const resultColor = won ? '#00ff88' : '#ff4488';
      ctx.shadowColor = resultColor;
      ctx.shadowBlur = 30;
      ctx.fillStyle = resultColor;
      ctx.font = `bold ${s.w * 0.07}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(won ? 'YOU WIN!' : 'CPU WINS', s.w / 2, s.h / 2 - 20);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${s.w * 0.045}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillText(`${s.playerScore} - ${s.aiScore}`, s.w / 2, s.h / 2 + 25);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = `${s.w * 0.025}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillText('Tap or press any key to restart', s.w / 2, s.h / 2 + 60);
    }
  }, []);

  const update = useCallback(() => {
    const s = stateRef.current;
    if (!s || s.gameOver) return;

    // Serve countdown
    if (s.serving) {
      s.serveTimer--;
      if (s.serveTimer <= 0) s.serving = false;
      return;
    }

    // Player movement
    const paddleSpeed = s.h * 0.015;
    if (keysRef.current.has('ArrowUp') || keysRef.current.has('w')) {
      s.playerY = Math.max(s.paddleH / 2, s.playerY - paddleSpeed);
    }
    if (keysRef.current.has('ArrowDown') || keysRef.current.has('s')) {
      s.playerY = Math.min(s.h - s.paddleH / 2, s.playerY + paddleSpeed);
    }

    // Touch movement
    if (touchYRef.current !== null) {
      s.playerY = Math.max(s.paddleH / 2, Math.min(s.h - s.paddleH / 2, touchYRef.current));
    }

    // AI movement - tracks ball with slight imperfection
    const aiTarget = s.ballY + (Math.random() - 0.5) * AI_JITTER;
    const aiDiff = aiTarget - s.aiY;
    if (Math.abs(aiDiff) > 3) {
      s.aiY += Math.sign(aiDiff) * Math.min(Math.abs(aiDiff), s.aiSpeed);
    }
    s.aiY = Math.max(s.paddleH / 2, Math.min(s.h - s.paddleH / 2, s.aiY));

    // Ball movement
    s.ballX += s.ballVX;
    s.ballY += s.ballVY;

    // Top/bottom bounce
    if (s.ballY - s.ballR <= 0 || s.ballY + s.ballR >= s.h) {
      s.ballVY *= -1;
      s.ballY = s.ballY - s.ballR <= 0 ? s.ballR : s.h - s.ballR;
      spawnParticles(s.ballX, s.ballY, '#ffffff44', 5);
      playSound('pong_wall');
    }

    // Player paddle collision
    const playerPaddleRight = s.margin + s.paddleW;
    if (
      s.ballX - s.ballR <= playerPaddleRight &&
      s.ballX + s.ballR >= s.margin &&
      s.ballY >= s.playerY - s.paddleH / 2 &&
      s.ballY <= s.playerY + s.paddleH / 2 &&
      s.ballVX < 0
    ) {
      const hitPos = (s.ballY - s.playerY) / (s.paddleH / 2);
      const angle = hitPos * Math.PI * 0.35;
      const speed = Math.sqrt(s.ballVX ** 2 + s.ballVY ** 2) * 1.05;
      s.ballVX = Math.cos(angle) * speed;
      s.ballVY = Math.sin(angle) * speed;
      s.ballX = playerPaddleRight + s.ballR;
      spawnParticles(s.ballX, s.ballY, '#4488ff', 10);
      playSound('pong_paddle');
    }

    // AI paddle collision
    const aiPaddleLeft = s.w - s.margin - s.paddleW;
    if (
      s.ballX + s.ballR >= aiPaddleLeft &&
      s.ballX - s.ballR <= s.w - s.margin &&
      s.ballY >= s.aiY - s.paddleH / 2 &&
      s.ballY <= s.aiY + s.paddleH / 2 &&
      s.ballVX > 0
    ) {
      const hitPos = (s.ballY - s.aiY) / (s.paddleH / 2);
      const angle = hitPos * Math.PI * 0.35;
      const speed = Math.sqrt(s.ballVX ** 2 + s.ballVY ** 2) * 1.05;
      s.ballVX = -Math.cos(angle) * speed;
      s.ballVY = Math.sin(angle) * speed;
      s.ballX = aiPaddleLeft - s.ballR;
      spawnParticles(s.ballX, s.ballY, '#ff4444', 10);
    }

    // Scoring
    if (s.ballX < 0) {
      s.aiScore++;
      playSound('pong_score');
      spawnParticles(0, s.ballY, '#ff4444', 20);
      if (s.aiScore >= WINNING_SCORE) {
        s.gameOver = true;
        playSound('pong_game_over');
        if (!s.gameOverNotified) {
          s.gameOverNotified = true;
          setTimeout(() => onGameOver(s.playerScore), 2500);
        }
        return;
      }
      resetBall(s);
    }
    if (s.ballX > s.w) {
      s.playerScore++;
      playSound('pong_score');
      spawnParticles(s.w, s.ballY, '#4488ff', 20);
      if (s.playerScore >= WINNING_SCORE) {
        s.gameOver = true;
        playSound('pong_win');
        if (!s.gameOverNotified) {
          s.gameOverNotified = true;
          setTimeout(() => onGameOver(s.playerScore), 2500);
        }
        return;
      }
      resetBall(s);
    }

    // Update particles
    s.particles = s.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
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
      if (stateRef.current?.gameOver) { restart(); return; }
      if (['ArrowUp', 'ArrowDown', 'w', 's'].includes(e.key)) e.preventDefault();
      keysRef.current.add(e.key);
    };
    const up = (e: KeyboardEvent) => { keysRef.current.delete(e.key); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [restart]);

  // Touch — mapped proportionally to canvas coordinates regardless of touch position
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getCanvasY = (e: TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const touchClientY = e.touches[0].clientY;
      // Map touch position relative to canvas position, proportionally scaled to game height
      const relativeY = (touchClientY - rect.top) / rect.height;
      const s = stateRef.current;
      if (!s) return touchClientY - rect.top;
      // Clamp to valid paddle range and scale to game coordinates
      return Math.max(0, Math.min(1, relativeY)) * s.h;
    };

    const start = (e: TouchEvent) => {
      e.preventDefault();
      if (stateRef.current?.gameOver) { restart(); return; }
      touchYRef.current = getCanvasY(e);
    };
    const move = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        touchYRef.current = getCanvasY(e);
      }
    };
    const end = (e: TouchEvent) => {
      e.preventDefault();
      touchYRef.current = null;
    };

    window.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end, { passive: false });
    return () => {
      window.removeEventListener('touchstart', start);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
    };
  }, [restart]);

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
      if (stateRef.current) {
        const s = stateRef.current;
        const scaleX = width / s.w;
        const scaleY = height / s.h;
        s.playerY *= scaleY;
        s.aiY *= scaleY;
        s.ballX *= scaleX;
        s.ballY *= scaleY;
        s.w = width;
        s.h = height;
        s.paddleW = Math.max(6, width * PADDLE_WIDTH_RATIO);
        s.paddleH = Math.max(40, height * PADDLE_HEIGHT_RATIO);
        s.ballR = Math.max(5, Math.min(width, height) * BALL_RADIUS_RATIO);
        s.margin = width * PADDLE_MARGIN_RATIO;
        s.ballSpeed = Math.max(3, width * BALL_SPEED_RATIO);
        s.aiSpeed = Math.max(2, height * AI_SPEED_RATIO);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getSize]);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        flex: 1,
        minHeight: canvasSize.height + 16,
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
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
