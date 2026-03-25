'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface GalagaGameProps {
  onGameOver: (score: number) => void;
  level: 'easy' | 'medium' | 'hard';
}

interface Star {
  x: number;
  y: number;
  speed: number;
  brightness: number;
}

interface Bullet {
  x: number;
  y: number;
  isEnemy: boolean;
}

interface Enemy {
  x: number;
  y: number;
  type: 'basic' | 'medium' | 'boss';
  alive: boolean;
  diving: boolean;
  diveAngle: number;
  diveSpeed: number;
  origX: number;
  origY: number;
  animFrame: number;
  hp: number;
}

interface Explosion {
  x: number;
  y: number;
  frame: number;
  maxFrames: number;
}

const W = 380;
const H = 560;
const PLAYER_W = 28;
const PLAYER_H = 24;

export default function GalagaGame({ onGameOver, level }: GalagaGameProps) {
  // Difficulty settings
  const EXTRA_LIFE_INTERVAL = 3000;
  const MAX_LIVES = 5;
  const difficultyConfig = {
    easy:   { startLives: 3, rowMod: -2, colMod: -3, diveChanceBase: 0.001, diveChancePerWave: 0.0005, diveSpeedBase: 1.0, diveSpeedPerWave: 0.08, enemyShootChance: 0.005, formationShootInterval: 120 },
    medium: { startLives: 3, rowMod: 0, colMod: 0, diveChanceBase: 0.004, diveChancePerWave: 0.002, diveSpeedBase: 1.8, diveSpeedPerWave: 0.25, enemyShootChance: 0.02, formationShootInterval: 50 },
    hard:   { startLives: 3, rowMod: 1, colMod: 1, diveChanceBase: 0.007, diveChancePerWave: 0.004, diveSpeedBase: 2.2, diveSpeedPerWave: 0.35, enemyShootChance: 0.04, formationShootInterval: 30 },
  }[level];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    playerX: number;
    lives: number;
    score: number;
    wave: number;
    bullets: Bullet[];
    enemies: Enemy[];
    explosions: Explosion[];
    stars: Star[];
    gameOver: boolean;
    shootCooldown: number;
    waveDelay: number;
    invincible: number;
    frameCount: number;
    touchX: number | null;
    started: boolean;
    nextExtraLife: number;
    extraLifeFlash: number;
    deathFlash: number;
  } | null>(null);
  const animRef = useRef(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [wave, setWave] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [gameOverCalled, setGameOverCalled] = useState(false);
  const finalScoreRef = useRef(0);
  const keysRef = useRef<Set<string>>(new Set());

  const createStars = (): Star[] => {
    const stars: Star[] = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        speed: 0.5 + Math.random() * 2,
        brightness: 0.3 + Math.random() * 0.7,
      });
    }
    return stars;
  };

  const spawnWave = (waveNum: number): Enemy[] => {
    const enemies: Enemy[] = [];
    const rows = Math.min(3 + Math.floor(waveNum / 2) + difficultyConfig.rowMod, 5);
    const cols = Math.min(6 + Math.floor(waveNum / 3) + difficultyConfig.colMod, 9);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let type: Enemy['type'] = 'basic';
        let hp = 1;
        if (r === 0) { type = 'boss'; hp = 2 + Math.floor(waveNum / 3); }
        else if (r === 1) { type = 'medium'; hp = 1 + Math.floor(waveNum / 4); }

        const x = 40 + c * ((W - 80) / (cols - 1 || 1));
        const y = 40 + r * 36;
        enemies.push({
          x, y, type, alive: true, diving: false,
          diveAngle: 0, diveSpeed: difficultyConfig.diveSpeedBase + waveNum * difficultyConfig.diveSpeedPerWave,
          origX: x, origY: y, animFrame: 0, hp,
        });
      }
    }
    return enemies;
  };

  const initGame = useCallback(() => {
    stateRef.current = {
      playerX: W / 2,
      lives: difficultyConfig.startLives,
      score: 0,
      wave: 1,
      bullets: [],
      enemies: spawnWave(1),
      explosions: [],
      stars: createStars(),
      gameOver: false,
      shootCooldown: 0,
      waveDelay: 0,
      invincible: 0,
      frameCount: 0,
      touchX: null,
      started: false,
      nextExtraLife: EXTRA_LIFE_INTERVAL,
      extraLifeFlash: 0,
      deathFlash: 0,
    };
    setScore(0);
    setLives(difficultyConfig.startLives);
    setWave(1);
    setGameOver(false);
    setGameOverCalled(false);
  }, []);

  useEffect(() => { initGame(); }, [initGame]);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
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
      gs.started = true;
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      gs.touchX = (e.touches[0].clientX - rect.left) * scaleX;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      const gs = stateRef.current;
      if (gs) gs.touchX = null;
    };
    const handleTap = (e: TouchEvent) => {
      e.preventDefault();
      const gs = stateRef.current;
      if (!gs || gs.gameOver) return;
      gs.started = true;
      // Shoot on tap
      if (gs.shootCooldown <= 0) {
        gs.bullets.push({ x: gs.playerX, y: H - 50, isEnemy: false });
        gs.shootCooldown = 12;
      }
    };

    const handleTouchStart = (e: TouchEvent) => { handleTouch(e); handleTap(e); };

    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener('touchmove', handleTouch);
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

    const drawShip = (x: number, y: number, frameCount: number) => {
      // Metallic body gradient
      const bodyGrad = ctx.createLinearGradient(x - PLAYER_W / 2, y - PLAYER_H / 2, x + PLAYER_W / 2, y + PLAYER_H / 2);
      bodyGrad.addColorStop(0, '#aaddff');
      bodyGrad.addColorStop(0.3, '#4488cc');
      bodyGrad.addColorStop(0.6, '#225588');
      bodyGrad.addColorStop(1, '#113355');

      ctx.shadowColor = '#00ccff';
      ctx.shadowBlur = 10;

      // Main hull - sleek shape
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.moveTo(x, y - PLAYER_H / 2 - 2);
      ctx.lineTo(x + 5, y - PLAYER_H / 4);
      ctx.lineTo(x + PLAYER_W / 2, y + PLAYER_H / 2 - 2);
      ctx.lineTo(x + PLAYER_W / 4, y + PLAYER_H / 3);
      ctx.lineTo(x - PLAYER_W / 4, y + PLAYER_H / 3);
      ctx.lineTo(x - PLAYER_W / 2, y + PLAYER_H / 2 - 2);
      ctx.lineTo(x - 5, y - PLAYER_H / 4);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Cockpit shine
      const cockpitGrad = ctx.createRadialGradient(x, y - 4, 1, x, y - 2, 6);
      cockpitGrad.addColorStop(0, 'rgba(100,220,255,0.8)');
      cockpitGrad.addColorStop(1, 'rgba(0,100,200,0)');
      ctx.fillStyle = cockpitGrad;
      ctx.beginPath();
      ctx.ellipse(x, y - 2, 4, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Engine glow - cyan with flicker
      const engineFlicker = 3 + Math.random() * 5;
      const engineGrad = ctx.createLinearGradient(x, y + PLAYER_H / 3, x, y + PLAYER_H / 2 + engineFlicker);
      engineGrad.addColorStop(0, 'rgba(0,255,255,0.9)');
      engineGrad.addColorStop(0.5, 'rgba(0,150,255,0.5)');
      engineGrad.addColorStop(1, 'rgba(0,50,255,0)');

      ctx.fillStyle = engineGrad;
      ctx.beginPath();
      ctx.moveTo(x - 5, y + PLAYER_H / 3);
      ctx.lineTo(x, y + PLAYER_H / 2 + engineFlicker);
      ctx.lineTo(x + 5, y + PLAYER_H / 3);
      ctx.fill();

      // Side engines
      ctx.fillStyle = engineGrad;
      ctx.beginPath();
      ctx.moveTo(x - PLAYER_W / 3, y + PLAYER_H / 3 - 2);
      ctx.lineTo(x - PLAYER_W / 3, y + PLAYER_H / 2 + engineFlicker * 0.6);
      ctx.lineTo(x - PLAYER_W / 3 + 3, y + PLAYER_H / 3 - 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + PLAYER_W / 3 - 3, y + PLAYER_H / 3 - 2);
      ctx.lineTo(x + PLAYER_W / 3, y + PLAYER_H / 2 + engineFlicker * 0.6);
      ctx.lineTo(x + PLAYER_W / 3, y + PLAYER_H / 3 - 2);
      ctx.fill();
    };

    const drawEnemy = (e: Enemy, frameCount: number) => {
      const { x, y, type } = e;
      e.animFrame++;

      if (type === 'boss') {
        // Large beetle/diamond with red gradient and menacing glow
        const bossGrad = ctx.createRadialGradient(x, y - 2, 2, x, y, 18);
        bossGrad.addColorStop(0, '#ff8866');
        bossGrad.addColorStop(0.5, '#cc2222');
        bossGrad.addColorStop(1, '#880000');

        ctx.shadowColor = '#ff2200';
        ctx.shadowBlur = 12;
        ctx.fillStyle = bossGrad;
        ctx.beginPath();
        ctx.moveTo(x, y - 15);
        ctx.quadraticCurveTo(x + 8, y - 10, x + 17, y);
        ctx.quadraticCurveTo(x + 12, y + 4, x + 10, y + 7);
        ctx.lineTo(x, y + 4);
        ctx.lineTo(x - 10, y + 7);
        ctx.quadraticCurveTo(x - 12, y + 4, x - 17, y);
        ctx.quadraticCurveTo(x - 8, y - 10, x, y - 15);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        // Inner eye/core
        const coreGrad = ctx.createRadialGradient(x, y - 2, 0, x, y - 2, 6);
        coreGrad.addColorStop(0, '#ffddaa');
        coreGrad.addColorStop(1, '#ff4400');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(x, y - 2, 5, 0, Math.PI * 2);
        ctx.fill();

      } else if (type === 'medium') {
        // Butterfly with pink/magenta gradient and pulsing wing glow
        const wingFlap = Math.sin(e.animFrame * 0.15) * 4;
        const pulse = Math.sin(e.animFrame * 0.08) * 0.3 + 0.7;

        ctx.shadowColor = `rgba(255,80,255,${pulse})`;
        ctx.shadowBlur = 10;

        const medGrad = ctx.createLinearGradient(x - 14, y - 8, x + 14, y + 8);
        medGrad.addColorStop(0, '#ff66cc');
        medGrad.addColorStop(0.5, '#cc22aa');
        medGrad.addColorStop(1, '#ff66cc');
        ctx.fillStyle = medGrad;

        ctx.beginPath();
        ctx.moveTo(x, y - 9);
        ctx.quadraticCurveTo(x + 6, y - 8, x + 13 + wingFlap, y - 3);
        ctx.quadraticCurveTo(x + 10, y + 3, x + 8, y + 9);
        ctx.lineTo(x, y + 5);
        ctx.lineTo(x - 8, y + 9);
        ctx.quadraticCurveTo(x - 10, y + 3, x - 13 - wingFlap, y - 3);
        ctx.quadraticCurveTo(x - 6, y - 8, x, y - 9);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        // Wing details
        ctx.fillStyle = `rgba(255,180,255,${0.3 + pulse * 0.2})`;
        ctx.beginPath();
        ctx.arc(x - 7, y, 3, 0, Math.PI * 2);
        ctx.arc(x + 7, y, 3, 0, Math.PI * 2);
        ctx.fill();

      } else {
        // Insect-like with green gradient and glowing wings
        const basicGrad = ctx.createLinearGradient(x, y - 8, x, y + 8);
        basicGrad.addColorStop(0, '#66ff66');
        basicGrad.addColorStop(0.5, '#22aa22');
        basicGrad.addColorStop(1, '#116611');

        ctx.shadowColor = '#00ff44';
        ctx.shadowBlur = 8;
        ctx.fillStyle = basicGrad;

        // Body
        ctx.beginPath();
        ctx.moveTo(x, y - 9);
        ctx.lineTo(x + 6, y - 3);
        ctx.lineTo(x + 10, y + 6);
        ctx.lineTo(x, y + 4);
        ctx.lineTo(x - 10, y + 6);
        ctx.lineTo(x - 6, y - 3);
        ctx.closePath();
        ctx.fill();

        // Glowing wing tips
        const wingPulse = Math.sin(e.animFrame * 0.2) * 0.3 + 0.7;
        ctx.shadowBlur = 6;
        ctx.fillStyle = `rgba(100,255,100,${wingPulse})`;
        ctx.beginPath();
        ctx.arc(x - 8, y + 2, 2.5, 0, Math.PI * 2);
        ctx.arc(x + 8, y + 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // HP indicator for tough enemies
      if (e.hp > 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 4;
        ctx.fillText(`${e.hp}`, x, y + 17);
        ctx.shadowBlur = 0;
      }
    };

    // Particle system for explosions
    interface Particle {
      x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number;
    }
    const particles: Particle[] = [];

    const spawnExplosionParticles = (ex: number, ey: number, color: string, count: number) => {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const speed = 1.5 + Math.random() * 3;
        particles.push({
          x: ex, y: ey,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 15 + Math.random() * 15,
          maxLife: 30,
          color,
          size: 1.5 + Math.random() * 2.5,
        });
      }
    };

    const drawExplosion = (exp: Explosion) => {
      const progress = exp.frame / exp.maxFrames;
      const alpha = 1 - progress;

      if (exp.frame === 1) {
        // Spawn particles on first frame
        const colors = ['#ffcc44', '#ff6622', '#ff4400', '#fff'];
        for (const c of colors) {
          spawnExplosionParticles(exp.x, exp.y, c, 4);
        }
      }

      // Central flash
      if (progress < 0.3) {
        const flashR = 15 * (1 - progress / 0.3);
        const flashGrad = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, flashR);
        flashGrad.addColorStop(0, `rgba(255,255,255,${alpha})`);
        flashGrad.addColorStop(0.5, `rgba(255,200,100,${alpha * 0.6})`);
        flashGrad.addColorStop(1, 'rgba(255,100,0,0)');
        ctx.fillStyle = flashGrad;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, flashR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Expanding ring
      const ringR = 5 + progress * 25;
      ctx.strokeStyle = `rgba(255,180,50,${alpha * 0.5})`;
      ctx.lineWidth = 2 - progress * 1.5;
      if (ctx.lineWidth > 0.2) {
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    const loop = () => {
      const gs = stateRef.current;
      if (!gs) return;

      gs.frameCount++;

      // Death flash freeze
      if (gs.deathFlash > 0) {
        gs.deathFlash--;
        // Still draw the frame but skip game logic
        // Background
        const bgGrad2 = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad2.addColorStop(0, '#020010');
        bgGrad2.addColorStop(0.5, '#050020');
        bgGrad2.addColorStop(1, '#020010');
        ctx.fillStyle = bgGrad2;
        ctx.fillRect(0, 0, W, H);
        // Draw entities frozen
        gs.stars.forEach(s2 => {
          ctx.fillStyle = `rgba(200,220,255,${s2.brightness})`;
          ctx.beginPath();
          ctx.arc(s2.x, s2.y, s2.speed > 1.5 ? 1 : 0.5, 0, Math.PI * 2);
          ctx.fill();
        });
        gs.enemies.forEach(e2 => { if (e2.alive) drawEnemy(e2, gs.frameCount); });
        // Draw and update particles during flash
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life--;
          const alpha = p.life / p.maxLife;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          if (p.life <= 0) particles.splice(i, 1);
        }
        gs.explosions = gs.explosions.filter(exp => {
          drawExplosion(exp);
          exp.frame++;
          return exp.frame < exp.maxFrames;
        });
        // Red/white overlay
        const flashAlpha = (gs.deathFlash / 30) * 0.5;
        if (gs.deathFlash > 20) {
          ctx.fillStyle = `rgba(255,255,255,${flashAlpha * 0.6})`;
        } else {
          ctx.fillStyle = `rgba(255,0,0,${flashAlpha})`;
        }
        ctx.fillRect(0, 0, W, H);
        animRef.current = requestAnimationFrame(loop);
        return;
      }

      // Deep space background with gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#020010');
      bgGrad.addColorStop(0.5, '#050020');
      bgGrad.addColorStop(1, '#020010');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Animated starfield with depth and twinkling
      gs.stars.forEach(s => {
        s.y += s.speed;
        if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
        // Twinkle effect for some stars
        const twinkle = Math.sin(gs.frameCount * 0.1 + s.x * 10) * 0.2 + 0.8;
        const finalBrightness = s.brightness * twinkle;
        const starSize = s.speed > 1.5 ? 2 : s.speed > 1 ? 1.5 : 1;

        // Stars glow based on depth (speed = depth)
        if (starSize > 1.5) {
          ctx.shadowColor = `rgba(150,180,255,${finalBrightness * 0.5})`;
          ctx.shadowBlur = 3;
        }
        ctx.fillStyle = `rgba(200,220,255,${finalBrightness})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, starSize * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      if (!gs.gameOver) {
        // Input
        const keys = keysRef.current;
        const speed = 5;
        if (keys.has('ArrowLeft') || keys.has('a')) { gs.playerX -= speed; gs.started = true; }
        if (keys.has('ArrowRight') || keys.has('d')) { gs.playerX += speed; gs.started = true; }
        if (keys.has(' ') && gs.shootCooldown <= 0) {
          gs.bullets.push({ x: gs.playerX, y: H - 50, isEnemy: false });
          gs.shootCooldown = 12;
          gs.started = true;
        }

        // Touch movement + auto-fire while touching
        if (gs.touchX !== null) {
          const diff = gs.touchX - gs.playerX;
          gs.playerX += Math.sign(diff) * Math.min(Math.abs(diff), speed);
          // Auto-fire while touching
          if (gs.shootCooldown <= 0) {
            gs.bullets.push({ x: gs.playerX, y: H - 50, isEnemy: false });
            gs.shootCooldown = 12;
          }
        }

        gs.playerX = Math.max(PLAYER_W / 2, Math.min(W - PLAYER_W / 2, gs.playerX));
        if (gs.shootCooldown > 0) gs.shootCooldown--;
        if (gs.invincible > 0) gs.invincible--;

        // Formation sway
        if (gs.started) {
          const sway = Math.sin(gs.frameCount * 0.02) * 20;
          gs.enemies.forEach(e => {
            if (e.alive && !e.diving) {
              e.x = e.origX + sway;
            }
          });

          // Random dive
          const aliveEnemies = gs.enemies.filter(e => e.alive && !e.diving);
          const diveChance = difficultyConfig.diveChanceBase + gs.wave * difficultyConfig.diveChancePerWave;
          aliveEnemies.forEach(e => {
            if (Math.random() < diveChance) {
              e.diving = true;
              e.diveAngle = Math.atan2(H - 40 - e.y, gs.playerX - e.x);
            }
          });

          // Move diving enemies
          gs.enemies.forEach(e => {
            if (e.alive && e.diving) {
              e.x += Math.cos(e.diveAngle) * e.diveSpeed;
              e.y += Math.sin(e.diveAngle) * e.diveSpeed;

              // Enemy shoots while diving
              if (Math.random() < difficultyConfig.enemyShootChance) {
                gs.bullets.push({ x: e.x, y: e.y + 10, isEnemy: true });
              }

              if (e.y > H + 20) {
                e.diving = false;
                e.x = e.origX;
                e.y = e.origY;
              }
            }
          });

          // Random shots from formation
          if (gs.frameCount % difficultyConfig.formationShootInterval === 0) {
            const shooters = gs.enemies.filter(e => e.alive && !e.diving);
            if (shooters.length > 0) {
              const shooter = shooters[Math.floor(Math.random() * shooters.length)];
              gs.bullets.push({ x: shooter.x, y: shooter.y + 10, isEnemy: true });
            }
          }
        }

        // Move bullets
        gs.bullets = gs.bullets.filter(b => {
          b.y += b.isEnemy ? 5 : -8;
          return b.y > -10 && b.y < H + 10;
        });

        // Bullet-enemy collisions
        gs.bullets = gs.bullets.filter(b => {
          if (b.isEnemy) return true;
          for (const e of gs.enemies) {
            if (!e.alive) continue;
            if (Math.abs(b.x - e.x) < 14 && Math.abs(b.y - e.y) < 14) {
              e.hp--;
              if (e.hp <= 0) {
                e.alive = false;
                const pts = e.type === 'boss' ? 40 : e.type === 'medium' ? 20 : 10;
                gs.score += pts;
                setScore(gs.score);
                // Extra life check
                if (gs.score >= gs.nextExtraLife && gs.lives < MAX_LIVES) {
                  gs.lives++;
                  gs.nextExtraLife += EXTRA_LIFE_INTERVAL;
                  gs.extraLifeFlash = 60;
                  setLives(gs.lives);
                }
                gs.explosions.push({ x: e.x, y: e.y, frame: 0, maxFrames: 20 });
              }
              return false;
            }
          }
          return true;
        });

        // Bullet-player collisions
        if (gs.invincible <= 0) {
          gs.bullets = gs.bullets.filter(b => {
            if (!b.isEnemy) return true;
            if (Math.abs(b.x - gs.playerX) < PLAYER_W / 2 && Math.abs(b.y - (H - 40)) < PLAYER_H / 2) {
              gs.lives--;
              gs.invincible = 120;
              gs.deathFlash = 30;
              setLives(gs.lives);
              gs.explosions.push({ x: gs.playerX, y: H - 40, frame: 0, maxFrames: 30 });
              if (gs.lives <= 0) {
                gs.gameOver = true;
                finalScoreRef.current = gs.score;
                setGameOver(true);
              }
              return false;
            }
            return true;
          });

          // Diving enemy collision with player
          gs.enemies.forEach(e => {
            if (e.alive && e.diving && gs.invincible <= 0) {
              if (Math.abs(e.x - gs.playerX) < 20 && Math.abs(e.y - (H - 40)) < 20) {
                e.alive = false;
                gs.lives--;
                gs.invincible = 120;
                gs.deathFlash = 30;
                setLives(gs.lives);
                gs.explosions.push({ x: gs.playerX, y: H - 40, frame: 0, maxFrames: 30 });
                gs.explosions.push({ x: e.x, y: e.y, frame: 0, maxFrames: 20 });
                if (gs.lives <= 0) {
                  gs.gameOver = true;
                  finalScoreRef.current = gs.score;
                  setGameOver(true);
                }
              }
            }
          });
        }

        // Wave complete
        if (gs.enemies.every(e => !e.alive) && gs.waveDelay <= 0) {
          gs.waveDelay = 60;
        }
        if (gs.waveDelay > 0) {
          gs.waveDelay--;
          if (gs.waveDelay === 0 && gs.enemies.every(e => !e.alive)) {
            gs.wave++;
            setWave(gs.wave);
            gs.enemies = spawnWave(gs.wave);
          }
        }
      }

      // Draw bullets with energy trail
      gs.bullets.forEach(b => {
        if (b.isEnemy) {
          // Red energy drop
          const enemyBulletGrad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 4);
          enemyBulletGrad.addColorStop(0, '#ff8866');
          enemyBulletGrad.addColorStop(0.5, '#ff2200');
          enemyBulletGrad.addColorStop(1, 'rgba(255,0,0,0)');
          ctx.fillStyle = enemyBulletGrad;
          ctx.beginPath();
          ctx.ellipse(b.x, b.y, 2.5, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          // Trail
          ctx.fillStyle = 'rgba(255,60,20,0.2)';
          ctx.beginPath();
          ctx.ellipse(b.x, b.y - 5, 2, 6, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Bright cyan/yellow energy bolt
          ctx.shadowColor = '#00ffff';
          ctx.shadowBlur = 8;
          const boltGrad = ctx.createLinearGradient(b.x, b.y - 6, b.x, b.y + 6);
          boltGrad.addColorStop(0, '#ffffff');
          boltGrad.addColorStop(0.3, '#88ffff');
          boltGrad.addColorStop(1, 'rgba(0,200,255,0)');
          ctx.fillStyle = boltGrad;
          ctx.beginPath();
          ctx.ellipse(b.x, b.y, 2, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          // Trail
          ctx.fillStyle = 'rgba(0,200,255,0.15)';
          ctx.beginPath();
          ctx.ellipse(b.x, b.y + 8, 3, 10, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      // Draw enemies
      gs.enemies.forEach(e => { if (e.alive) drawEnemy(e, gs.frameCount); });

      // Draw explosions
      gs.explosions = gs.explosions.filter(exp => {
        drawExplosion(exp);
        exp.frame++;
        return exp.frame < exp.maxFrames;
      });

      // Draw and update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // slight gravity
        p.life--;
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 4;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        if (p.life <= 0) particles.splice(i, 1);
      }

      // Draw player
      if (!gs.gameOver) {
        if (gs.invincible > 0) {
          const t = Date.now() * 0.01;
          ctx.save();
          ctx.globalAlpha = 0.4 + Math.sin(t) * 0.4;
          drawShip(gs.playerX, H - 40, gs.frameCount);
          // Glow ring
          ctx.strokeStyle = '#00ccff';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#00ccff';
          ctx.shadowBlur = 15 + Math.sin(t * 2) * 10;
          ctx.beginPath();
          ctx.arc(gs.playerX, H - 40, 20, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else {
          drawShip(gs.playerX, H - 40, gs.frameCount);
        }
      }

      // 1UP flash
      if (gs.extraLifeFlash > 0) {
        gs.extraLifeFlash--;
        ctx.save();
        ctx.globalAlpha = gs.extraLifeFlash / 60;
        ctx.fillStyle = '#00ff88';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 20;
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('1UP!', W / 2, H / 2 - 40);
        ctx.restore();
      }

      // Game over text with neon glow
      if (gs.gameOver) {
        ctx.shadowColor = '#ff2200';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', W / 2, H / 2);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '16px monospace';
        ctx.fillText(`Final Score: ${gs.score}`, W / 2, H / 2 + 30);
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

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
        <span>Wave: {wave}</span>
        <span>{lives === 1 ? <span className="text-red-500 animate-pulse">LAST LIFE</span> : `Lives: ${lives - 1}`}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="rounded-lg border-2 border-purple-700 bg-black max-w-full touch-none"
      />
      <p className="text-xs text-gray-400 font-mono">Arrows/drag to move, Space/tap to shoot</p>
    </div>
  );
}
