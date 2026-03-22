'use client';

import { useRef, useEffect, useCallback } from 'react';

interface SpaceInvadersGameProps {
  onGameOver: (score: number) => void;
  level: 'easy' | 'medium' | 'hard';
}

const W = 400;
const H = 500;

interface Bullet { x: number; y: number; dy: number; }
interface Alien { x: number; y: number; row: number; alive: boolean; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number; }
interface Star { x: number; y: number; size: number; brightness: number; twinkleSpeed: number; phase: number; }

export default function SpaceInvadersGame({ onGameOver, level }: SpaceInvadersGameProps) {
  // Level-based settings
  const alienRows = level === 'easy' ? 3 : 5;
  const initialAlienSpeed = level === 'easy' ? 0.25 : level === 'hard' ? 0.7 : 0.4;
  const enemyShootChance = level === 'easy' ? 0.005 : level === 'hard' ? 0.03 : 0.015;
  const initialLives = level === 'easy' ? 5 : level === 'hard' ? 2 : 3;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    playerX: W / 2,
    lives: initialLives,
    score: 0,
    bullets: [] as Bullet[],
    enemyBullets: [] as Bullet[],
    aliens: [] as Alien[],
    alienDir: 1 as number,
    alienSpeed: 0.4,
    alienMoveTimer: 0,
    gameOver: false,
    gameOverTime: 0,
    started: false,
    lastShot: 0,
    invincibleUntil: 0,
    touchX: -1,
    particles: [] as Particle[],
    stars: [] as Star[],
    time: 0,
  });

  function initAliens(s: typeof stateRef.current) {
    s.aliens = [];
    for (let row = 0; row < alienRows; row++) {
      for (let col = 0; col < 10; col++) {
        s.aliens.push({
          x: 40 + col * 34,
          y: 50 + row * 32,
          row,
          alive: true,
        });
      }
    }
  }

  function initStars(s: typeof stateRef.current) {
    s.stars = [];
    for (let i = 0; i < 80; i++) {
      s.stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        size: 0.5 + Math.random() * 2,
        brightness: 0.3 + Math.random() * 0.7,
        twinkleSpeed: 0.5 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function spawnExplosion(s: typeof stateRef.current, x: number, y: number, color: string) {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 / 12) * i + Math.random() * 0.5;
      const speed = 1.5 + Math.random() * 3;
      s.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color,
        size: 1.5 + Math.random() * 2.5,
      });
    }
  }

  const shoot = useCallback(() => {
    const s = stateRef.current;
    if (s.gameOver || !s.started) return;
    const now = Date.now();
    if (now - s.lastShot < 300) return;
    s.lastShot = now;
    s.bullets.push({ x: s.playerX, y: H - 40, dy: -6 });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const s = stateRef.current;
    // Reset
    s.playerX = W / 2;
    s.lives = 3;
    s.score = 0;
    s.bullets = [];
    s.enemyBullets = [];
    s.alienDir = 1;
    s.alienSpeed = initialAlienSpeed;
    s.alienMoveTimer = 0;
    s.gameOver = false;
    s.gameOverTime = 0;
    s.started = false;
    s.lastShot = 0;
    s.invincibleUntil = 0;
    s.touchX = -1;
    s.particles = [];
    s.time = 0;
    s.lives = initialLives;
    initAliens(s);
    initStars(s);

    canvas.width = W;
    canvas.height = H;

    const PLAYER_W = 30;
    const PLAYER_H = 16;
    const ALIEN_W = 24;
    const ALIEN_H = 18;
    const ROW_POINTS = [30, 30, 20, 20, 10];

    function drawAlien(x: number, y: number, row: number) {
      if (!ctx) return;
      const t = s.time;

      if (row < 2) {
        // Top aliens - glowing red orbs with antenna
        const pulse = 0.85 + Math.sin(t * 0.05 + x * 0.1) * 0.15;

        // Outer glow
        ctx.save();
        ctx.shadowColor = '#ff3333';
        ctx.shadowBlur = 12 * pulse;

        // Main orb body
        const orbGrad = ctx.createRadialGradient(x - 2, y - 3, 2, x, y, 10);
        orbGrad.addColorStop(0, '#ff8888');
        orbGrad.addColorStop(0.5, '#ff3333');
        orbGrad.addColorStop(1, '#aa0000');
        ctx.fillStyle = orbGrad;
        ctx.beginPath();
        ctx.ellipse(x, y, 10 * pulse, 9 * pulse, 0, 0, Math.PI * 2);
        ctx.fill();

        // Glossy highlight
        ctx.fillStyle = 'rgba(255,200,200,0.4)';
        ctx.beginPath();
        ctx.ellipse(x - 2, y - 3, 5, 3, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Antennae
        ctx.strokeStyle = '#ff6666';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        const wave = Math.sin(t * 0.08) * 3;
        ctx.beginPath();
        ctx.moveTo(x - 5, y - 8);
        ctx.quadraticCurveTo(x - 8 + wave, y - 16, x - 10, y - 14);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 5, y - 8);
        ctx.quadraticCurveTo(x + 8 - wave, y - 16, x + 10, y - 14);
        ctx.stroke();

        // Antenna tips
        ctx.fillStyle = '#ff6666';
        ctx.beginPath(); ctx.arc(x - 10, y - 14, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 10, y - 14, 2, 0, Math.PI * 2); ctx.fill();

        // Eyes
        ctx.fillStyle = '#ffcccc';
        ctx.beginPath(); ctx.arc(x - 3, y - 1, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 3, y - 1, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#220000';
        ctx.beginPath(); ctx.arc(x - 3, y - 1, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 3, y - 1, 1.2, 0, Math.PI * 2); ctx.fill();

        ctx.restore();

      } else if (row < 4) {
        // Middle aliens - orange diamond shapes with pulsing glow
        const pulse = 0.9 + Math.sin(t * 0.04 + y * 0.1) * 0.1;

        ctx.save();
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = 10 * pulse;

        // Diamond body
        const diamGrad = ctx.createRadialGradient(x, y - 2, 2, x, y, 12);
        diamGrad.addColorStop(0, '#ffcc44');
        diamGrad.addColorStop(0.5, '#ff8800');
        diamGrad.addColorStop(1, '#994400');
        ctx.fillStyle = diamGrad;
        ctx.beginPath();
        ctx.moveTo(x, y - 12 * pulse);
        ctx.lineTo(x + 12 * pulse, y);
        ctx.lineTo(x, y + 10 * pulse);
        ctx.lineTo(x - 12 * pulse, y);
        ctx.closePath();
        ctx.fill();

        // Glossy shine
        ctx.fillStyle = 'rgba(255,230,150,0.35)';
        ctx.beginPath();
        ctx.moveTo(x, y - 10 * pulse);
        ctx.lineTo(x + 6 * pulse, y - 2);
        ctx.lineTo(x, y);
        ctx.lineTo(x - 6 * pulse, y - 2);
        ctx.closePath();
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x - 4, y - 2, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 4, y - 2, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#331100';
        ctx.beginPath(); ctx.arc(x - 4, y - 2, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 4, y - 2, 1.2, 0, Math.PI * 2); ctx.fill();

        // Side spikes
        ctx.strokeStyle = '#ff9933';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - 12, y);
        ctx.lineTo(x - 16, y + 5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 12, y);
        ctx.lineTo(x + 16, y + 5);
        ctx.stroke();

        ctx.restore();

      } else {
        // Bottom aliens - green smooth blobs with eyes
        const pulse = 0.9 + Math.sin(t * 0.06 + x * 0.05) * 0.1;

        ctx.save();
        ctx.shadowColor = '#33ff33';
        ctx.shadowBlur = 8 * pulse;

        // Main body (smooth rounded shape)
        const bodyGrad = ctx.createRadialGradient(x - 2, y - 3, 2, x, y, 12);
        bodyGrad.addColorStop(0, '#88ff88');
        bodyGrad.addColorStop(0.4, '#33dd33');
        bodyGrad.addColorStop(1, '#117711');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.ellipse(x, y - 2, 11 * pulse, 8 * pulse, 0, 0, Math.PI * 2);
        ctx.fill();

        // Bottom tentacle bumps
        ctx.fillStyle = '#22aa22';
        const wave = Math.sin(t * 0.06) * 2;
        ctx.beginPath(); ctx.arc(x - 7, y + 7 + wave, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x, y + 8, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 7, y + 7 - wave, 3, 0, Math.PI * 2); ctx.fill();

        // Glossy highlight
        ctx.fillStyle = 'rgba(200,255,200,0.3)';
        ctx.beginPath();
        ctx.ellipse(x - 2, y - 5, 6, 3, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x - 4, y - 3, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 4, y - 3, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#003300';
        ctx.beginPath(); ctx.arc(x - 4, y - 3, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 4, y - 3, 1.5, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
      }
    }

    function drawPlayer(x: number, y: number) {
      if (!ctx) return;

      ctx.save();
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 15;

      // Engine flame
      const flicker = 0.7 + Math.random() * 0.3;
      const flameGrad = ctx.createLinearGradient(x, y + PLAYER_H, x, y + PLAYER_H + 12);
      flameGrad.addColorStop(0, '#00ffff');
      flameGrad.addColorStop(0.4, '#0088ff');
      flameGrad.addColorStop(1, 'rgba(0,50,255,0)');
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(x - 6, y + PLAYER_H);
      ctx.lineTo(x, y + PLAYER_H + 12 * flicker);
      ctx.lineTo(x + 6, y + PLAYER_H);
      ctx.closePath();
      ctx.fill();

      // Side flames
      const sFlameGrad = ctx.createLinearGradient(x, y + PLAYER_H, x, y + PLAYER_H + 8);
      sFlameGrad.addColorStop(0, '#00ddff');
      sFlameGrad.addColorStop(1, 'rgba(0,100,255,0)');
      ctx.fillStyle = sFlameGrad;
      ctx.beginPath();
      ctx.moveTo(x - 12, y + PLAYER_H - 2);
      ctx.lineTo(x - 10, y + PLAYER_H + 6 * flicker);
      ctx.lineTo(x - 8, y + PLAYER_H - 2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 8, y + PLAYER_H - 2);
      ctx.lineTo(x + 10, y + PLAYER_H + 6 * flicker);
      ctx.lineTo(x + 12, y + PLAYER_H - 2);
      ctx.closePath();
      ctx.fill();

      // Ship body - sleek triangular craft
      const shipGrad = ctx.createLinearGradient(x - PLAYER_W / 2, y, x + PLAYER_W / 2, y + PLAYER_H);
      shipGrad.addColorStop(0, '#66ffff');
      shipGrad.addColorStop(0.4, '#00cccc');
      shipGrad.addColorStop(1, '#005566');
      ctx.fillStyle = shipGrad;

      // Main hull (sleek triangle)
      ctx.beginPath();
      ctx.moveTo(x, y - 10);                           // nose
      ctx.lineTo(x + PLAYER_W / 2 + 2, y + PLAYER_H); // right wing tip
      ctx.lineTo(x + 4, y + PLAYER_H - 4);             // right inner
      ctx.lineTo(x - 4, y + PLAYER_H - 4);             // left inner
      ctx.lineTo(x - PLAYER_W / 2 - 2, y + PLAYER_H); // left wing tip
      ctx.closePath();
      ctx.fill();

      // Cockpit canopy
      const canopyGrad = ctx.createRadialGradient(x, y, 1, x, y + 2, 6);
      canopyGrad.addColorStop(0, '#aaffff');
      canopyGrad.addColorStop(0.6, '#00aacc');
      canopyGrad.addColorStop(1, '#004455');
      ctx.fillStyle = canopyGrad;
      ctx.beginPath();
      ctx.ellipse(x, y + 2, 4, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wing edge highlights
      ctx.strokeStyle = 'rgba(100,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x - PLAYER_W / 2 - 2, y + PLAYER_H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x + PLAYER_W / 2 + 2, y + PLAYER_H);
      ctx.stroke();

      ctx.restore();
    }

    function drawStars() {
      if (!ctx) return;
      for (const star of s.stars) {
        const twinkle = star.brightness * (0.5 + 0.5 * Math.sin(s.time * 0.02 * star.twinkleSpeed + star.phase));
        ctx.save();
        ctx.globalAlpha = twinkle;
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#aaccff';
        ctx.shadowBlur = star.size * 3;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    function drawBullets() {
      if (!ctx) return;

      // Player bullets - bright cyan energy bolts
      for (const b of s.bullets) {
        ctx.save();
        // Trail
        const trailGrad = ctx.createLinearGradient(b.x, b.y + 12, b.x, b.y);
        trailGrad.addColorStop(0, 'rgba(0,255,255,0)');
        trailGrad.addColorStop(1, 'rgba(0,255,255,0.6)');
        ctx.fillStyle = trailGrad;
        ctx.fillRect(b.x - 1.5, b.y, 3, 12);

        // Bolt core
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#aaffff';
        ctx.fillRect(b.x - 1.5, b.y, 3, 6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(b.x - 0.5, b.y + 1, 1, 4);
        ctx.restore();
      }

      // Enemy bullets - red energy drops
      for (const b of s.enemyBullets) {
        ctx.save();
        // Trail
        const trailGrad = ctx.createLinearGradient(b.x, b.y - 8, b.x, b.y + 8);
        trailGrad.addColorStop(0, 'rgba(255,50,50,0)');
        trailGrad.addColorStop(0.5, 'rgba(255,80,80,0.5)');
        trailGrad.addColorStop(1, 'rgba(255,50,50,0.8)');
        ctx.fillStyle = trailGrad;
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, 3, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.shadowColor = '#ff3333';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#ff8888';
        ctx.beginPath();
        ctx.arc(b.x, b.y + 2, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffcccc';
        ctx.beginPath();
        ctx.arc(b.x, b.y + 1, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    function updateParticles() {
      s.particles = s.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.life -= 0.03;
        return p.life > 0;
      });
    }

    function drawParticles() {
      if (!ctx) return;
      for (const p of s.particles) {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    function draw() {
      if (!ctx) return;
      // Deep space background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#020010');
      bgGrad.addColorStop(0.5, '#06001a');
      bgGrad.addColorStop(1, '#0a0020');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Twinkling stars
      drawStars();

      // Aliens
      for (const a of s.aliens) {
        if (a.alive) drawAlien(a.x, a.y, a.row);
      }

      // Player
      if (!s.gameOver) {
        const blink = Date.now() < s.invincibleUntil && Math.floor(Date.now() / 100) % 2;
        if (!blink) drawPlayer(s.playerX, H - 36);
      }

      // Bullets
      drawBullets();

      // Particles
      drawParticles();

      // HUD
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 4;
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`SCORE: ${s.score}`, 10, 24);

      // Lives as glowing hearts
      ctx.fillStyle = '#ff4466';
      ctx.shadowColor = '#ff2244';
      ctx.shadowBlur = 8;
      ctx.font = '18px sans-serif';
      ctx.fillText('\u2665'.repeat(s.lives), W - 70, 24);
      ctx.restore();

      // Start screen
      if (!s.started) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.textAlign = 'center';

        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 25;
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('SPACE INVADERS', W / 2, H / 2 - 20);

        ctx.shadowBlur = 10;
        ctx.fillStyle = '#8888cc';
        ctx.font = '14px sans-serif';
        ctx.fillText('Tap or Press Space to Start', W / 2, H / 2 + 14);
        ctx.restore();
        ctx.textAlign = 'left';
      }

      if (s.gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.textAlign = 'center';

        ctx.fillStyle = '#ff2244';
        ctx.shadowColor = '#ff0033';
        ctx.shadowBlur = 30;
        ctx.font = 'bold 26px sans-serif';
        ctx.fillText('GAME OVER', W / 2, H / 2 - 30);

        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 15;
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(`Score: ${s.score}`, W / 2, H / 2 + 6);

        // High score
        const stored = localStorage.getItem('retroride-scores');
        let best = 0;
        if (stored) {
          try {
            const scores = JSON.parse(stored);
            const entries = scores['space-invaders'] || [];
            best = entries.reduce((max: number, e: { score: number }) => Math.max(max, e.score), 0);
          } catch {}
        }
        best = Math.max(best, s.score);
        ctx.fillStyle = '#fbbf24';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 12;
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText(`Best: ${best}`, W / 2, H / 2 + 32);

        ctx.restore();
        ctx.textAlign = 'left';
      }
    }

    const keys: Record<string, boolean> = {};

    let animId = 0;
    function loop() {
      s.time++;

      if (s.started && !s.gameOver) {
        // Player movement
        if (keys['ArrowLeft'] || keys['a']) s.playerX = Math.max(PLAYER_W / 2, s.playerX - 4);
        if (keys['ArrowRight'] || keys['d']) s.playerX = Math.min(W - PLAYER_W / 2, s.playerX + 4);

        // Touch movement
        if (s.touchX >= 0) {
          const canvasRect = canvas!.getBoundingClientRect();
          const scaleX = W / canvasRect.width;
          const targetX = (s.touchX - canvasRect.left) * scaleX;
          const dx = targetX - s.playerX;
          s.playerX += Math.sign(dx) * Math.min(Math.abs(dx), 5);
          s.playerX = Math.max(PLAYER_W / 2, Math.min(W - PLAYER_W / 2, s.playerX));
        }

        // Move aliens
        s.alienMoveTimer++;
        if (s.alienMoveTimer > 2) {
          s.alienMoveTimer = 0;
          let shouldDrop = false;
          for (const a of s.aliens) {
            if (!a.alive) continue;
            if ((s.alienDir > 0 && a.x + ALIEN_W / 2 >= W - 10) ||
                (s.alienDir < 0 && a.x - ALIEN_W / 2 <= 10)) {
              shouldDrop = true;
              break;
            }
          }
          if (shouldDrop) {
            s.alienDir *= -1;
            for (const a of s.aliens) {
              a.y += 12;
            }
          }
          for (const a of s.aliens) {
            a.x += s.alienDir * s.alienSpeed * 8;
          }
        }

        // Aliens reach bottom check
        for (const a of s.aliens) {
          if (a.alive && a.y + ALIEN_H / 2 >= H - 40) {
            s.gameOver = true;
            s.gameOverTime = Date.now();
            break;
          }
        }

        // Player bullets
        s.bullets = s.bullets.filter(b => {
          b.y += b.dy;
          if (b.y < 0) return false;
          // Hit alien
          for (const a of s.aliens) {
            if (!a.alive) continue;
            if (Math.abs(b.x - a.x) < ALIEN_W / 2 + 2 && Math.abs(b.y - a.y) < ALIEN_H / 2 + 4) {
              a.alive = false;
              s.score += ROW_POINTS[a.row] || 10;
              // Explosion particles
              const colors = ['#ff4444', '#ffaa00', '#44ff44'];
              spawnExplosion(s, a.x, a.y, colors[Math.min(Math.floor(a.row / 2), 2)]);
              // Speed up as aliens decrease
              const alive = s.aliens.filter(a => a.alive).length;
              s.alienSpeed = initialAlienSpeed + (50 - alive) * 0.02;
              return false;
            }
          }
          return true;
        });

        // Enemy shooting
        if (Math.random() < enemyShootChance) {
          const aliveAliens = s.aliens.filter(a => a.alive);
          if (aliveAliens.length > 0) {
            const shooter = aliveAliens[Math.floor(Math.random() * aliveAliens.length)];
            s.enemyBullets.push({ x: shooter.x, y: shooter.y + ALIEN_H / 2, dy: 3 });
          }
        }

        // Enemy bullets
        s.enemyBullets = s.enemyBullets.filter(b => {
          b.y += b.dy;
          if (b.y > H) return false;
          // Hit player
          if (Date.now() > s.invincibleUntil &&
              Math.abs(b.x - s.playerX) < PLAYER_W / 2 + 2 &&
              b.y >= H - 36 && b.y <= H - 20) {
            s.lives--;
            spawnExplosion(s, s.playerX, H - 30, '#00ffff');
            if (s.lives <= 0) {
              s.gameOver = true;
              s.gameOverTime = Date.now();
            } else {
              s.invincibleUntil = Date.now() + 1500;
            }
            return false;
          }
          return true;
        });

        // All aliens dead - next wave
        if (s.aliens.every(a => !a.alive)) {
          initAliens(s);
          s.alienSpeed = initialAlienSpeed;
        }
      }

      // Delayed game over callback
      if (s.gameOver && s.gameOverTime > 0 && Date.now() - s.gameOverTime > 3000) {
        s.gameOverTime = 0; // prevent calling again
        onGameOver(s.score);
      }

      updateParticles();
      draw();
      animId = requestAnimationFrame(loop);
    }
    animId = requestAnimationFrame(loop);

    function handleKeyDown(e: KeyboardEvent) {
      keys[e.key] = true;
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!s.started) { s.started = true; return; }
        shoot();
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      keys[e.key] = false;
    }

    function handleTouchStart(e: TouchEvent) {
      e.preventDefault();
      if (!s.started) { s.started = true; return; }
      s.touchX = e.touches[0].clientX;
      shoot();
    }
    function handleTouchMove(e: TouchEvent) {
      e.preventDefault();
      s.touchX = e.touches[0].clientX;
    }
    function handleTouchEnd(e: TouchEvent) {
      e.preventDefault();
      s.touchX = -1;
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onGameOver, shoot, alienRows, initialAlienSpeed, enemyShootChance, initialLives]);

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
        }}
      />
    </div>
  );
}
