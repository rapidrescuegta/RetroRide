'use client';

import { useRef, useEffect, useCallback, useState } from 'react';

interface DoodleJumpGameProps {
  onGameOver: (score: number) => void;
  level: 'easy' | 'medium' | 'hard';
}

interface Platform {
  x: number;
  y: number; // world Y (increases upward)
  width: number;
  type: 'normal' | 'moving' | 'breaking';
  movingDir?: number; // 1 or -1
  movingSpeed?: number;
  broken?: boolean;
  breakAnim?: number;
}

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

interface Star {
  x: number;
  y: number; // world-relative for parallax
  size: number;
  brightness: number;
  twinkleSpeed: number;
}

interface GameState {
  playerX: number; // center X in pixels
  playerY: number; // world Y (bottom of player)
  velocityX: number;
  velocityY: number; // positive = upward
  platforms: Platform[];
  highestPlatformY: number;
  cameraY: number; // world Y at bottom of screen
  score: number;
  highestY: number;
  gameOver: boolean;
  canvasW: number;
  canvasH: number;
  lastTime: number;
  facing: number; // 1 = right, -1 = left
  particles: Particle[];
  stars: Star[];
  lastScore: number;
  scorePopups: { x: number; y: number; value: number; life: number }[];
}

const GRAVITY = -1800;
const JUMP_VELOCITY = 650;
const PLAYER_WIDTH = 28;
const PLAYER_HEIGHT = 32;
const PLATFORM_WIDTH = 60;
const PLATFORM_HEIGHT = 12;
const MOVE_SPEED = 350;
const MAX_HORIZONTAL_SPEED = 400;
const PLATFORM_SPACING_MIN = 40;
const PLATFORM_SPACING_MAX = 80;

function generateStars(count: number, yRange: number, canvasW: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * canvasW,
      y: Math.random() * yRange,
      size: 0.5 + Math.random() * 2,
      brightness: 0.3 + Math.random() * 0.7,
      twinkleSpeed: 1 + Math.random() * 3,
    });
  }
  return stars;
}

export default function DoodleJumpGame({ onGameOver, level }: DoodleJumpGameProps) {
  // Difficulty settings
  const difficultyConfig = {
    easy:   { spacingMin: 30, spacingMax: 60, breakChanceBase: 0.05, breakChanceDiff: 0.1, moveChanceBase: 0.05, moveChanceDiff: 0.1, moveSpeedBase: 30, moveSpeedDiff: 20 },
    medium: { spacingMin: 40, spacingMax: 80, breakChanceBase: 0.1, breakChanceDiff: 0.2, moveChanceBase: 0.1, moveChanceDiff: 0.25, moveSpeedBase: 40, moveSpeedDiff: 30 },
    hard:   { spacingMin: 50, spacingMax: 100, breakChanceBase: 0.15, breakChanceDiff: 0.3, moveChanceBase: 0.2, moveChanceDiff: 0.35, moveSpeedBase: 50, moveSpeedDiff: 50 },
  }[level];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const animFrameRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());
  const touchSideRef = useRef<number>(0); // -1 left, 0 none, 1 right
  const gameOverCalledRef = useRef(false);
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 600 });

  const getCanvasSize = useCallback(() => {
    const maxW = Math.min(window.innerWidth - 32, 400);
    const maxH = Math.min(window.innerHeight - 120, 650);
    return { width: maxW, height: maxH };
  }, []);

  const generatePlatforms = useCallback((fromY: number, toY: number, canvasW: number): Platform[] => {
    const platforms: Platform[] = [];
    let y = fromY;

    while (y < toY) {
      const spacing = difficultyConfig.spacingMin + Math.random() * (difficultyConfig.spacingMax - difficultyConfig.spacingMin);
      y += spacing;

      // Difficulty increases with height
      const difficulty = Math.min(y / 5000, 1);

      const rand = Math.random();
      let type: Platform['type'] = 'normal';
      if (rand < difficultyConfig.breakChanceBase + difficulty * difficultyConfig.breakChanceDiff) {
        type = 'breaking';
      } else if (rand < difficultyConfig.moveChanceBase + difficulty * difficultyConfig.moveChanceDiff) {
        type = 'moving';
      }

      const x = Math.random() * (canvasW - PLATFORM_WIDTH);
      const platform: Platform = { x, y, width: PLATFORM_WIDTH, type };

      if (type === 'moving') {
        platform.movingDir = Math.random() < 0.5 ? 1 : -1;
        platform.movingSpeed = difficultyConfig.moveSpeedBase + Math.random() * 60 + difficulty * difficultyConfig.moveSpeedDiff;
      }

      platforms.push(platform);

      // Ensure breaking platforms always have a reachable normal/moving platform nearby
      if (type === 'breaking') {
        const safeX = Math.random() * (canvasW - PLATFORM_WIDTH);
        platforms.push({
          x: safeX,
          y: y + 20 + Math.random() * 30,
          width: PLATFORM_WIDTH,
          type: Math.random() < 0.3 ? 'moving' : 'normal',
          movingDir: Math.random() < 0.5 ? 1 : -1,
          movingSpeed: 50,
        });
        y += 30;
      }
    }

    return platforms;
  }, [difficultyConfig]);

  const initGame = useCallback(() => {
    const { width, height } = getCanvasSize();
    setCanvasSize({ width, height });

    // Starting platform right under player
    const startPlatforms: Platform[] = [
      { x: width / 2 - PLATFORM_WIDTH / 2, y: 50, width: PLATFORM_WIDTH, type: 'normal' },
    ];

    const morePlatforms = generatePlatforms(50, height * 3, width);

    gameRef.current = {
      playerX: width / 2,
      playerY: 50 + PLATFORM_HEIGHT,
      velocityX: 0,
      velocityY: JUMP_VELOCITY,
      platforms: [...startPlatforms, ...morePlatforms],
      highestPlatformY: height * 3,
      cameraY: 0,
      score: 0,
      highestY: 0,
      gameOver: false,
      canvasW: width,
      canvasH: height,
      lastTime: 0,
      facing: 1,
      particles: [],
      stars: generateStars(120, height * 5, width),
      lastScore: 0,
      scorePopups: [],
    };
    gameOverCalledRef.current = false;
    keysRef.current.clear();
    touchSideRef.current = 0;
  }, [getCanvasSize, generatePlatforms]);

  useEffect(() => {
    initGame();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) {
        e.preventDefault();
        keysRef.current.add(e.key);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      touchSideRef.current = x < rect.width / 2 ? -1 : 1;
    };
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      touchSideRef.current = x < rect.width / 2 ? -1 : 1;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      touchSideRef.current = 0;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [initGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gameLoop = (timestamp: number) => {
      const g = gameRef.current;
      if (!g) { animFrameRef.current = requestAnimationFrame(gameLoop); return; }

      if (g.lastTime === 0) g.lastTime = timestamp;
      const dt = Math.min((timestamp - g.lastTime) / 1000, 0.03);
      g.lastTime = timestamp;

      if (!g.gameOver) {
        // Horizontal input
        let inputDir = 0;
        if (keysRef.current.has('ArrowLeft') || keysRef.current.has('a')) inputDir = -1;
        if (keysRef.current.has('ArrowRight') || keysRef.current.has('d')) inputDir = 1;
        if (touchSideRef.current !== 0) inputDir = touchSideRef.current;

        if (inputDir !== 0) {
          g.velocityX += inputDir * MOVE_SPEED * dt * 8;
          g.velocityX = Math.max(-MAX_HORIZONTAL_SPEED, Math.min(MAX_HORIZONTAL_SPEED, g.velocityX));
          g.facing = inputDir;
        } else {
          // Friction
          g.velocityX *= 0.85;
          if (Math.abs(g.velocityX) < 2) g.velocityX = 0;
        }

        // Apply gravity
        g.velocityY += GRAVITY * dt;

        // Move player
        g.playerX += g.velocityX * dt;
        g.playerY += g.velocityY * dt;

        // Horizontal wrap
        if (g.playerX < -PLAYER_WIDTH / 2) g.playerX = g.canvasW + PLAYER_WIDTH / 2;
        if (g.playerX > g.canvasW + PLAYER_WIDTH / 2) g.playerX = -PLAYER_WIDTH / 2;

        // Update moving platforms
        for (const p of g.platforms) {
          if (p.type === 'moving' && !p.broken) {
            p.x += (p.movingDir || 1) * (p.movingSpeed || 50) * dt;
            if (p.x <= 0) { p.x = 0; p.movingDir = 1; }
            if (p.x + p.width >= g.canvasW) { p.x = g.canvasW - p.width; p.movingDir = -1; }
          }
          // Breaking animation
          if (p.broken && p.breakAnim !== undefined) {
            p.breakAnim += dt;
          }
        }

        // Platform collision (only when falling)
        if (g.velocityY < 0) {
          const playerBottom = g.playerY;
          const playerLeft = g.playerX - PLAYER_WIDTH / 2;
          const playerRight = g.playerX + PLAYER_WIDTH / 2;

          for (const p of g.platforms) {
            if (p.broken) continue;

            const platTop = p.y + PLATFORM_HEIGHT;
            const prevBottom = playerBottom - g.velocityY * dt;

            // Check if player is passing through platform top
            if (
              playerRight > p.x + 4 &&
              playerLeft < p.x + p.width - 4 &&
              playerBottom <= platTop &&
              prevBottom >= platTop - 5
            ) {
              if (p.type === 'breaking') {
                p.broken = true;
                p.breakAnim = 0;
                // Spawn crumble particles
                for (let i = 0; i < 12; i++) {
                  g.particles.push({
                    x: p.x + Math.random() * p.width,
                    y: platTop,
                    vx: (Math.random() - 0.5) * 120,
                    vy: -Math.random() * 80 - 20,
                    life: 0.6 + Math.random() * 0.4,
                    maxLife: 1,
                    color: Math.random() > 0.5 ? '#8B6914' : '#a07830',
                    size: 2 + Math.random() * 3,
                  });
                }
              } else {
                g.playerY = platTop;
                g.velocityY = JUMP_VELOCITY;
                // Bounce particles
                for (let i = 0; i < 5; i++) {
                  g.particles.push({
                    x: g.playerX + (Math.random() - 0.5) * 20,
                    y: platTop,
                    vx: (Math.random() - 0.5) * 60,
                    vy: -Math.random() * 60 - 20,
                    life: 0.3 + Math.random() * 0.2,
                    maxLife: 0.5,
                    color: p.type === 'moving' ? '#66bbff' : '#66ff88',
                    size: 2 + Math.random() * 2,
                  });
                }
              }
            }
          }
        }

        // Update camera
        const screenY = g.playerY - g.cameraY;
        if (screenY > g.canvasH * 0.55) {
          g.cameraY = g.playerY - g.canvasH * 0.55;
        }

        // Score
        const currentHeight = Math.floor(g.playerY / 10);
        if (currentHeight > g.score) {
          g.score = currentHeight;
        }
        if (g.playerY > g.highestY) {
          g.highestY = g.playerY;
        }

        // Score popups
        const scoreDiff = g.score - g.lastScore;
        if (scoreDiff >= 10) {
          g.scorePopups.push({
            x: g.playerX,
            y: g.playerY + PLAYER_HEIGHT + 10,
            value: scoreDiff,
            life: 1.0,
          });
          g.lastScore = g.score;
        }

        // Generate more platforms above
        if (g.highestPlatformY < g.cameraY + g.canvasH * 3) {
          const newPlats = generatePlatforms(g.highestPlatformY, g.highestPlatformY + g.canvasH * 2, g.canvasW);
          g.platforms.push(...newPlats);
          g.highestPlatformY += g.canvasH * 2;
          // Generate more stars too
          const newStars = generateStars(30, g.canvasH * 2, g.canvasW);
          for (const s of newStars) {
            s.y += g.highestPlatformY;
          }
          g.stars.push(...newStars);
        }

        // Prune platforms below camera
        g.platforms = g.platforms.filter(p => p.y > g.cameraY - 100);
        // Prune stars far below
        g.stars = g.stars.filter(s => s.y > g.cameraY - 200);

        // Game over - fell below screen
        if (g.playerY < g.cameraY - PLAYER_HEIGHT * 2) {
          g.gameOver = true;
          if (!gameOverCalledRef.current) {
            gameOverCalledRef.current = true;
            setTimeout(() => onGameOver(g.score), 800);
          }
        }

        // Rising trail particles
        if (g.velocityY > 200) {
          if (Math.random() < 0.4) {
            g.particles.push({
              x: g.playerX + (Math.random() - 0.5) * 12,
              y: g.playerY - 2,
              vx: (Math.random() - 0.5) * 30,
              vy: -Math.random() * 40 - 10,
              life: 0.4 + Math.random() * 0.3,
              maxLife: 0.7,
              color: Math.random() > 0.5 ? '#aa66ff' : '#6644cc',
              size: 1.5 + Math.random() * 2,
            });
          }
        }
      }

      // Update particles
      for (let i = g.particles.length - 1; i >= 0; i--) {
        const p = g.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy -= 200 * dt; // slight downward drift in world coords
        p.life -= dt;
        if (p.life <= 0) {
          g.particles.splice(i, 1);
        }
      }

      // Update score popups
      for (let i = g.scorePopups.length - 1; i >= 0; i--) {
        const sp = g.scorePopups[i];
        sp.y += 40 * dt;
        sp.life -= dt;
        if (sp.life <= 0) {
          g.scorePopups.splice(i, 1);
        }
      }

      // --- DRAW ---
      const W = canvas.width;
      const H = canvas.height;

      // Deep space background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      const heightPhase = Math.min(g.cameraY / 3000, 1);
      // Transitions from dark blue to deeper purple as you go higher
      bgGrad.addColorStop(0, `rgb(${10 + heightPhase * 20}, ${5 + heightPhase * 5}, ${40 + heightPhase * 30})`);
      bgGrad.addColorStop(0.5, `rgb(${15 + heightPhase * 10}, ${8}, ${55 + heightPhase * 15})`);
      bgGrad.addColorStop(1, `rgb(${8 + heightPhase * 5}, ${12 + heightPhase * 5}, ${35 + heightPhase * 20})`);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Helper: world Y to screen Y (Y increases upward, screen Y increases downward)
      const toScreenY = (worldY: number) => H - (worldY - g.cameraY);

      // Draw stars with twinkling
      for (const star of g.stars) {
        const sy = toScreenY(star.y);
        if (sy < -5 || sy > H + 5) continue;
        // Parallax: stars move at 0.3x speed
        const parallaxY = H - ((star.y * 0.3) - g.cameraY * 0.3);
        if (parallaxY < -5 || parallaxY > H + 5) continue;

        const twinkle = 0.5 + 0.5 * Math.sin(timestamp / 1000 * star.twinkleSpeed + star.x * 0.1);
        const alpha = star.brightness * twinkle;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, parallaxY, star.size, 0, Math.PI * 2);
        ctx.fill();

        // Larger stars get a subtle glow
        if (star.size > 1.5) {
          ctx.fillStyle = `rgba(200, 220, 255, ${alpha * 0.2})`;
          ctx.beginPath();
          ctx.arc(star.x, parallaxY, star.size * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw particles (behind platforms)
      for (const p of g.particles) {
        const psy = toScreenY(p.y);
        if (psy < -10 || psy > H + 10) continue;
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 5;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, psy, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Draw platforms
      for (const p of g.platforms) {
        const sy = toScreenY(p.y + PLATFORM_HEIGHT);
        if (sy > H + 20 || sy < -40) continue;

        if (p.broken) {
          // Breaking animation - pieces fall and fade with glow
          const t = p.breakAnim || 0;
          ctx.globalAlpha = Math.max(0, 1 - t * 2.5);
          const pieces = 5;
          const pieceW = p.width / pieces;
          for (let i = 0; i < pieces; i++) {
            const px = p.x + i * pieceW + (Math.random() - 0.5) * t * 40;
            const py = sy + t * 250 + i * 8 * t;
            const rot = t * (i - 2) * 2;
            ctx.save();
            ctx.translate(px + pieceW / 2, py + PLATFORM_HEIGHT / 2);
            ctx.rotate(rot);
            const pieceGrad = ctx.createLinearGradient(-pieceW / 2, -PLATFORM_HEIGHT / 2, -pieceW / 2, PLATFORM_HEIGHT / 2);
            pieceGrad.addColorStop(0, '#a08040');
            pieceGrad.addColorStop(1, '#705020');
            ctx.fillStyle = pieceGrad;
            ctx.beginPath();
            ctx.roundRect(-pieceW / 2, -PLATFORM_HEIGHT / 2, pieceW - 2, PLATFORM_HEIGHT, 2);
            ctx.fill();
            ctx.restore();
          }
          ctx.globalAlpha = 1;
          continue;
        }

        if (p.type === 'normal') {
          // Green platform with glossy gradient and glow
          ctx.shadowColor = '#44ff88';
          ctx.shadowBlur = 8;
          const platGrad = ctx.createLinearGradient(p.x, sy, p.x, sy + PLATFORM_HEIGHT);
          platGrad.addColorStop(0, '#66ff88');
          platGrad.addColorStop(0.3, '#44dd66');
          platGrad.addColorStop(0.7, '#33bb55');
          platGrad.addColorStop(1, '#228844');
          ctx.fillStyle = platGrad;
          ctx.beginPath();
          ctx.roundRect(p.x, sy, p.width, PLATFORM_HEIGHT, 6);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Glossy shine highlight
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.beginPath();
          ctx.roundRect(p.x + 4, sy + 1, p.width - 8, 4, [3, 3, 0, 0]);
          ctx.fill();

          // Bottom edge
          ctx.fillStyle = 'rgba(0, 80, 30, 0.4)';
          ctx.beginPath();
          ctx.roundRect(p.x, sy + PLATFORM_HEIGHT - 3, p.width, 3, [0, 0, 6, 6]);
          ctx.fill();

        } else if (p.type === 'moving') {
          // Blue platform with trail/motion blur and glow
          // Motion trail
          const trailDir = -(p.movingDir || 1);
          for (let ti = 3; ti >= 1; ti--) {
            ctx.globalAlpha = 0.08 * ti;
            ctx.fillStyle = '#3388ff';
            ctx.beginPath();
            ctx.roundRect(p.x + trailDir * ti * 6, sy, p.width, PLATFORM_HEIGHT, 6);
            ctx.fill();
          }
          ctx.globalAlpha = 1;

          ctx.shadowColor = '#4488ff';
          ctx.shadowBlur = 10;
          const platGrad = ctx.createLinearGradient(p.x, sy, p.x, sy + PLATFORM_HEIGHT);
          platGrad.addColorStop(0, '#66aaff');
          platGrad.addColorStop(0.3, '#4488ee');
          platGrad.addColorStop(0.7, '#3366cc');
          platGrad.addColorStop(1, '#2255aa');
          ctx.fillStyle = platGrad;
          ctx.beginPath();
          ctx.roundRect(p.x, sy, p.width, PLATFORM_HEIGHT, 6);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Glossy shine
          ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.beginPath();
          ctx.roundRect(p.x + 4, sy + 1, p.width - 8, 4, [3, 3, 0, 0]);
          ctx.fill();

          // Subtle pulsing glow ring
          const pulseAlpha = 0.15 + 0.1 * Math.sin(timestamp / 300);
          ctx.strokeStyle = `rgba(100, 180, 255, ${pulseAlpha})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(p.x - 2, sy - 2, p.width + 4, PLATFORM_HEIGHT + 4, 8);
          ctx.stroke();

        } else {
          // Breaking platform - cracked brown with warning look
          const platGrad = ctx.createLinearGradient(p.x, sy, p.x, sy + PLATFORM_HEIGHT);
          platGrad.addColorStop(0, '#b08840');
          platGrad.addColorStop(0.5, '#8B6914');
          platGrad.addColorStop(1, '#6B4F0A');
          ctx.fillStyle = platGrad;
          ctx.beginPath();
          ctx.roundRect(p.x, sy, p.width, PLATFORM_HEIGHT, 6);
          ctx.fill();

          // Crack lines
          ctx.strokeStyle = 'rgba(40, 25, 5, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x + p.width * 0.2, sy);
          ctx.lineTo(p.x + p.width * 0.35, sy + PLATFORM_HEIGHT * 0.6);
          ctx.lineTo(p.x + p.width * 0.3, sy + PLATFORM_HEIGHT);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(p.x + p.width * 0.65, sy);
          ctx.lineTo(p.x + p.width * 0.55, sy + PLATFORM_HEIGHT * 0.5);
          ctx.lineTo(p.x + p.width * 0.7, sy + PLATFORM_HEIGHT);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(p.x + p.width * 0.4, sy + PLATFORM_HEIGHT * 0.4);
          ctx.lineTo(p.x + p.width * 0.55, sy + PLATFORM_HEIGHT * 0.5);
          ctx.stroke();

          // Subtle warning glow
          ctx.shadowColor = '#aa6600';
          ctx.shadowBlur = 4;
          ctx.strokeStyle = 'rgba(200, 150, 50, 0.2)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(p.x, sy, p.width, PLATFORM_HEIGHT, 6);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      // Draw score popups
      for (const sp of g.scorePopups) {
        const spy = toScreenY(sp.y);
        const alpha = Math.max(0, sp.life);
        ctx.globalAlpha = alpha;
        ctx.shadowColor = '#00ffaa';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#00ffaa';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`+${sp.value}`, sp.x, spy);
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;

      // Draw player (cute alien creature)
      if (!g.gameOver || g.playerY > g.cameraY - PLAYER_HEIGHT * 2) {
        const sx = g.playerX;
        const sy = toScreenY(g.playerY + PLAYER_HEIGHT);
        const dir = g.facing;

        // Squash/stretch based on velocity
        const vyNorm = g.velocityY / JUMP_VELOCITY;
        const stretchY = 1 + Math.max(-0.15, Math.min(0.2, vyNorm * 0.15));
        const squashX = 1 / Math.sqrt(stretchY);

        ctx.save();
        ctx.translate(sx, sy + PLAYER_HEIGHT / 2);
        ctx.scale(squashX, stretchY);
        ctx.translate(0, -PLAYER_HEIGHT / 2);

        // Character glow
        ctx.shadowColor = '#aa66ff';
        ctx.shadowBlur = 15;

        // Body - gradient alien/creature body
        const bodyGrad = ctx.createRadialGradient(0, PLAYER_HEIGHT * 0.45, 2, 0, PLAYER_HEIGHT * 0.45, PLAYER_WIDTH * 0.6);
        bodyGrad.addColorStop(0, '#dd88ff');
        bodyGrad.addColorStop(0.5, '#aa55dd');
        bodyGrad.addColorStop(1, '#7733aa');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.ellipse(0, PLAYER_HEIGHT * 0.45, PLAYER_WIDTH / 2, PLAYER_HEIGHT * 0.47, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Body outline glow
        ctx.strokeStyle = 'rgba(200, 130, 255, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Belly highlight
        ctx.fillStyle = 'rgba(230, 180, 255, 0.3)';
        ctx.beginPath();
        ctx.ellipse(0, PLAYER_HEIGHT * 0.35, PLAYER_WIDTH * 0.3, PLAYER_HEIGHT * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Small limbs/legs
        ctx.fillStyle = '#8844bb';
        // Left leg
        ctx.beginPath();
        ctx.ellipse(-6, PLAYER_HEIGHT * 0.85, 4, 6, -0.2, 0, Math.PI * 2);
        ctx.fill();
        // Right leg
        ctx.beginPath();
        ctx.ellipse(6, PLAYER_HEIGHT * 0.85, 4, 6, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Feet with glow
        ctx.shadowColor = '#cc88ff';
        ctx.shadowBlur = 4;
        ctx.fillStyle = '#9955cc';
        ctx.beginPath();
        ctx.ellipse(-7, PLAYER_HEIGHT * 0.95, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(7, PLAYER_HEIGHT * 0.95, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Small arms
        ctx.fillStyle = '#9955cc';
        ctx.beginPath();
        ctx.ellipse(-PLAYER_WIDTH * 0.4 - 2, PLAYER_HEIGHT * 0.45, 4, 3, -0.5 * dir, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(PLAYER_WIDTH * 0.4 + 2, PLAYER_HEIGHT * 0.45, 4, 3, 0.5 * dir, 0, Math.PI * 2);
        ctx.fill();

        // Eyes - big expressive eyes
        const eyeOffsetX = 2 * dir;
        // Eye whites
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(-6 + eyeOffsetX * 0.3, PLAYER_HEIGHT * 0.25, 7, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(6 + eyeOffsetX * 0.3, PLAYER_HEIGHT * 0.25, 7, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eye outlines
        ctx.strokeStyle = 'rgba(80, 40, 120, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(-6 + eyeOffsetX * 0.3, PLAYER_HEIGHT * 0.25, 7, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(6 + eyeOffsetX * 0.3, PLAYER_HEIGHT * 0.25, 7, 8, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Irises - colorful
        const irisGrad = ctx.createRadialGradient(-5 + dir * 2, PLAYER_HEIGHT * 0.25, 0, -5 + dir * 2, PLAYER_HEIGHT * 0.25, 4);
        irisGrad.addColorStop(0, '#44ddff');
        irisGrad.addColorStop(1, '#2288aa');
        ctx.fillStyle = irisGrad;
        ctx.beginPath();
        ctx.arc(-5 + dir * 2.5, PLAYER_HEIGHT * 0.26, 4, 0, Math.PI * 2);
        ctx.fill();
        const irisGrad2 = ctx.createRadialGradient(7 + dir * 2, PLAYER_HEIGHT * 0.25, 0, 7 + dir * 2, PLAYER_HEIGHT * 0.25, 4);
        irisGrad2.addColorStop(0, '#44ddff');
        irisGrad2.addColorStop(1, '#2288aa');
        ctx.fillStyle = irisGrad2;
        ctx.beginPath();
        ctx.arc(7 + dir * 2.5, PLAYER_HEIGHT * 0.26, 4, 0, Math.PI * 2);
        ctx.fill();

        // Pupils
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(-4.5 + dir * 3, PLAYER_HEIGHT * 0.26, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(7.5 + dir * 3, PLAYER_HEIGHT * 0.26, 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Eye shine/sparkle
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-6 + dir * 1.5, PLAYER_HEIGHT * 0.2, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(6 + dir * 1.5, PLAYER_HEIGHT * 0.2, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Cute mouth
        ctx.strokeStyle = '#6633aa';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(dir * 2, PLAYER_HEIGHT * 0.45, 4, 0.1, Math.PI - 0.1);
        ctx.stroke();

        // Small antennae
        ctx.strokeStyle = '#aa66dd';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-4, PLAYER_HEIGHT * 0.02);
        ctx.quadraticCurveTo(-8, -10, -12, -8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(4, PLAYER_HEIGHT * 0.02);
        ctx.quadraticCurveTo(8, -10, 12, -8);
        ctx.stroke();
        // Antenna tips glow
        ctx.shadowColor = '#ff88ff';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#ff88ff';
        ctx.beginPath();
        ctx.arc(-12, -8, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(12, -8, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore();
      }

      // HUD - Score with neon style
      ctx.fillStyle = 'rgba(10, 5, 30, 0.7)';
      ctx.beginPath();
      ctx.roundRect(W / 2 - 50, 6, 100, 32, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(170, 100, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(W / 2 - 50, 6, 100, 32, 10);
      ctx.stroke();
      ctx.shadowColor = '#aa66ff';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${g.score}`, W / 2, 22);
      ctx.shadowBlur = 0;

      // Game over overlay
      if (g.gameOver) {
        // Dark vignette
        const vignetteGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
        vignetteGrad.addColorStop(0, 'rgba(0,0,0,0.3)');
        vignetteGrad.addColorStop(1, 'rgba(0,0,0,0.85)');
        ctx.fillStyle = vignetteGrad;
        ctx.fillRect(0, 0, W, H);

        ctx.shadowColor = '#cc44ff';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', W / 2, H / 2 - 10);
        ctx.shadowColor = '#aa66ff';
        ctx.shadowBlur = 10;
        ctx.font = '18px monospace';
        ctx.fillText(`Score: ${g.score}`, W / 2, H / 2 + 20);
        ctx.shadowBlur = 0;
      }

      animFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animFrameRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [canvasSize, generatePlatforms, onGameOver]);

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="rounded-lg border-2 border-purple-900/50 touch-none"
        style={{ maxWidth: '100%', background: '#0a0528' }}
      />
      <p className="text-xs text-gray-400 text-center">
        Arrow keys / A-D to move. Touch left/right side of screen.
      </p>
    </div>
  );
}
