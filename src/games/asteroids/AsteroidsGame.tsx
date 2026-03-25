'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface AsteroidsGameProps {
  onGameOver: (score: number) => void;
  level: 'easy' | 'medium' | 'hard';
}

const BASE_W = 600;
const BASE_H = 600;

type Vec2 = { x: number; y: number };

type Ship = {
  pos: Vec2;
  vel: Vec2;
  angle: number;
  thrusting: boolean;
  invincibleTimer: number;
};

type Bullet = {
  pos: Vec2;
  vel: Vec2;
  life: number;
};

type Asteroid = {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  size: 'large' | 'medium' | 'small';
  vertices: Vec2[];
  rotation: number;
  rotSpeed: number;
};

type Particle = {
  pos: Vec2;
  vel: Vec2;
  life: number;
  maxLife: number;
  color?: string;
  size?: number;
};

type Star = {
  x: number;
  y: number;
  brightness: number;
  twinkleSpeed: number;
  depth: number;
  size: number;
};

function randomAsteroidVertices(radius: number): Vec2[] {
  const count = 8 + Math.floor(Math.random() * 5);
  const verts: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = radius * (0.7 + Math.random() * 0.6);
    verts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  }
  return verts;
}

function spawnAsteroid(size: 'large' | 'medium' | 'small', pos?: Vec2): Asteroid {
  const radiusMap = { large: 40, medium: 22, small: 12 };
  const radius = radiusMap[size];
  const speedMap = { large: 0.8, medium: 1.5, small: 2.2 };
  const speed = speedMap[size] * (0.7 + Math.random() * 0.6);
  const angle = Math.random() * Math.PI * 2;

  const p = pos || {
    x: Math.random() < 0.5 ? -radius : BASE_W + radius,
    y: Math.random() * BASE_H,
  };

  return {
    pos: { ...p },
    vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    radius,
    size,
    vertices: randomAsteroidVertices(radius),
    rotation: 0,
    rotSpeed: (Math.random() - 0.5) * 0.03,
  };
}

function wrap(pos: Vec2) {
  if (pos.x < -50) pos.x = BASE_W + 50;
  if (pos.x > BASE_W + 50) pos.x = -50;
  if (pos.y < -50) pos.y = BASE_H + 50;
  if (pos.y > BASE_H + 50) pos.y = -50;
}

function dist(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export default function AsteroidsGame({ onGameOver, level }: AsteroidsGameProps) {
  // Level-based settings
  const startingAsteroids = level === 'easy' ? 1 : level === 'hard' ? 5 : 3;
  const asteroidSpeedMultiplier = level === 'easy' ? 0.4 : level === 'hard' ? 1.3 : 1.0;
  const initialLives = 3;
  const EXTRA_LIFE_INTERVAL = 2000;
  const MAX_LIVES = 5;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const stateRef = useRef<{
    ship: Ship;
    bullets: Bullet[];
    asteroids: Asteroid[];
    particles: Particle[];
    score: number;
    lives: number;
    wave: number;
    gameOver: boolean;
    animFrame: number;
    lastTime: number;
    shootCooldown: number;
    respawnTimer: number;
    stars: Star[];
    starsInited: boolean;
    shieldFlash: number;
    nebulaTime: number;
    nextExtraLife: number;
    extraLifeFlash: number;
    deathFlash: number;
  } | null>(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(initialLives);
  const [canvasSize, setCanvasSize] = useState({ w: BASE_W, h: BASE_H });
  const touchRef = useRef<{ left: boolean; right: boolean; thrust: boolean; shoot: boolean }>({
    left: false, right: false, thrust: false, shoot: false,
  });

  const spawnWave = useCallback((wave: number): Asteroid[] => {
    const count = startingAsteroids + wave;
    return Array.from({ length: count }, () => {
      const a = spawnAsteroid('large');
      a.vel.x *= asteroidSpeedMultiplier;
      a.vel.y *= asteroidSpeedMultiplier;
      return a;
    });
  }, [startingAsteroids, asteroidSpeedMultiplier]);

  // Resize
  useEffect(() => {
    const resize = () => {
      const maxW = Math.min(window.innerWidth - 32, 600);
      const maxH = Math.min(window.innerHeight - 240, 600);
      const scale = Math.min(maxW / BASE_W, maxH / BASE_H, 1);
      setCanvasSize({ w: BASE_W * scale, h: BASE_H * scale });
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      keysRef.current.add(e.key);
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = BASE_W;
    canvas.height = BASE_H;

    const initShip = (): Ship => ({
      pos: { x: BASE_W / 2, y: BASE_H / 2 },
      vel: { x: 0, y: 0 },
      angle: -Math.PI / 2,
      thrusting: false,
      invincibleTimer: 120,
    });

    // Generate star field
    const stars: Star[] = [];
    for (let i = 0; i < 120; i++) {
      stars.push({
        x: Math.random() * BASE_W,
        y: Math.random() * BASE_H,
        brightness: 0.15 + Math.random() * 0.6,
        twinkleSpeed: 0.5 + Math.random() * 2,
        depth: Math.random(),
        size: 0.5 + Math.random() * 1.5,
      });
    }

    stateRef.current = {
      ship: initShip(),
      bullets: [],
      asteroids: spawnWave(0),
      particles: [],
      score: 0,
      lives: initialLives,
      wave: 0,
      gameOver: false,
      animFrame: 0,
      lastTime: 0,
      shootCooldown: 0,
      respawnTimer: 0,
      stars,
      starsInited: true,
      shieldFlash: 0,
      nebulaTime: 0,
      nextExtraLife: EXTRA_LIFE_INTERVAL,
      extraLifeFlash: 0,
      deathFlash: 0,
    };

    const spawnExplosion = (pos: Vec2, count: number, isShip: boolean) => {
      const s = stateRef.current!;
      for (let p = 0; p < count; p++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * (isShip ? 4 : 3);
        const colors = isShip
          ? ['#ff6b35', '#ffcc02', '#ffffff', '#ff3366']
          : ['#ff9500', '#ffcc00', '#ffffff', '#ff6600'];
        s.particles.push({
          pos: { ...pos },
          vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
          life: 15 + Math.random() * (isShip ? 40 : 25),
          maxLife: isShip ? 55 : 40,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 1 + Math.random() * (isShip ? 3 : 2),
        });
      }
    };

    const drawBackground = (ctx: CanvasRenderingContext2D, s: NonNullable<typeof stateRef.current>) => {
      // Deep space base
      ctx.fillStyle = '#020108';
      ctx.fillRect(0, 0, BASE_W, BASE_H);

      // Nebula zones (very subtle)
      s.nebulaTime += 0.003;
      const t = s.nebulaTime;

      // Purple nebula
      const nebGrad1 = ctx.createRadialGradient(
        BASE_W * 0.3 + Math.sin(t * 0.5) * 30, BASE_H * 0.3 + Math.cos(t * 0.4) * 20, 20,
        BASE_W * 0.3, BASE_H * 0.3, 180
      );
      nebGrad1.addColorStop(0, 'rgba(100, 40, 160, 0.06)');
      nebGrad1.addColorStop(0.5, 'rgba(60, 20, 100, 0.03)');
      nebGrad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = nebGrad1;
      ctx.fillRect(0, 0, BASE_W, BASE_H);

      // Blue nebula
      const nebGrad2 = ctx.createRadialGradient(
        BASE_W * 0.75 + Math.cos(t * 0.3) * 25, BASE_H * 0.65 + Math.sin(t * 0.6) * 15, 15,
        BASE_W * 0.75, BASE_H * 0.65, 200
      );
      nebGrad2.addColorStop(0, 'rgba(30, 80, 180, 0.05)');
      nebGrad2.addColorStop(0.5, 'rgba(15, 40, 120, 0.025)');
      nebGrad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = nebGrad2;
      ctx.fillRect(0, 0, BASE_W, BASE_H);

      // Stars with twinkling
      const time = Date.now() * 0.001;
      for (const star of s.stars) {
        const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(time * star.twinkleSpeed + star.x * 0.1));
        const alpha = star.brightness * twinkle;
        const depthColor = star.depth > 0.7 ? `rgba(200, 220, 255, ${alpha})` :
          star.depth > 0.4 ? `rgba(180, 190, 220, ${alpha})` :
            `rgba(140, 150, 180, ${alpha * 0.7})`;
        ctx.fillStyle = depthColor;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * (0.5 + star.depth * 0.5), 0, Math.PI * 2);
        ctx.fill();

        // Bright stars get a cross flare
        if (star.brightness > 0.5 && star.depth > 0.6 && twinkle > 0.8) {
          ctx.strokeStyle = `rgba(200, 220, 255, ${alpha * 0.3})`;
          ctx.lineWidth = 0.5;
          const len = star.size * 3;
          ctx.beginPath();
          ctx.moveTo(star.x - len, star.y);
          ctx.lineTo(star.x + len, star.y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(star.x, star.y - len);
          ctx.lineTo(star.x, star.y + len);
          ctx.stroke();
        }
      }
    };

    const drawShip = (ctx: CanvasRenderingContext2D, ship: Ship) => {
      ctx.save();
      ctx.translate(ship.pos.x, ship.pos.y);
      ctx.rotate(ship.angle);

      // Engine thrust glow
      if (ship.thrusting) {
        // Outer glow
        const thrustGrad = ctx.createRadialGradient(-10, 0, 0, -14, 0, 20);
        thrustGrad.addColorStop(0, 'rgba(100, 180, 255, 0.3)');
        thrustGrad.addColorStop(0.5, 'rgba(60, 120, 255, 0.1)');
        thrustGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = thrustGrad;
        ctx.beginPath();
        ctx.arc(-14, 0, 20, 0, Math.PI * 2);
        ctx.fill();

        // Flame
        const flameLen = 14 + Math.random() * 10;
        const flameGrad = ctx.createLinearGradient(-8, 0, -8 - flameLen, 0);
        flameGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        flameGrad.addColorStop(0.2, 'rgba(100, 180, 255, 0.8)');
        flameGrad.addColorStop(0.6, 'rgba(60, 100, 255, 0.5)');
        flameGrad.addColorStop(1, 'rgba(30, 50, 200, 0)');
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.moveTo(-8, -5);
        ctx.lineTo(-8 - flameLen, 0);
        ctx.lineTo(-8, 5);
        ctx.closePath();
        ctx.fill();

        // Inner white core
        ctx.fillStyle = 'rgba(200, 230, 255, 0.6)';
        ctx.beginPath();
        ctx.moveTo(-8, -2.5);
        ctx.lineTo(-8 - flameLen * 0.5, 0);
        ctx.lineTo(-8, 2.5);
        ctx.closePath();
        ctx.fill();
      }

      // Ship body fill
      const shipGrad = ctx.createLinearGradient(-12, -10, 16, 10);
      shipGrad.addColorStop(0, '#4a90d9');
      shipGrad.addColorStop(0.5, '#7ab8ff');
      shipGrad.addColorStop(1, '#3a70b0');
      ctx.fillStyle = shipGrad;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-12, -10);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-12, 10);
      ctx.closePath();
      ctx.fill();

      // Ship outline glow
      ctx.shadowColor = '#5599ff';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = '#99ccff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-12, -10);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-12, 10);
      ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Cockpit
      ctx.fillStyle = 'rgba(150, 220, 255, 0.5)';
      ctx.beginPath();
      ctx.ellipse(4, 0, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const drawAsteroid = (ctx: CanvasRenderingContext2D, a: Asteroid) => {
      ctx.save();
      ctx.translate(a.pos.x, a.pos.y);
      ctx.rotate(a.rotation);

      // Asteroid fill gradient
      const fillGrad = ctx.createRadialGradient(-a.radius * 0.2, -a.radius * 0.2, a.radius * 0.1, 0, 0, a.radius);
      fillGrad.addColorStop(0, '#8a7a6a');
      fillGrad.addColorStop(0.4, '#6a5a4a');
      fillGrad.addColorStop(0.8, '#4a3a2a');
      fillGrad.addColorStop(1, '#3a2a1a');
      ctx.fillStyle = fillGrad;
      ctx.beginPath();
      ctx.moveTo(a.vertices[0].x, a.vertices[0].y);
      for (let i = 1; i < a.vertices.length; i++) {
        ctx.lineTo(a.vertices[i].x, a.vertices[i].y);
      }
      ctx.closePath();
      ctx.fill();

      // Surface details (craters)
      ctx.fillStyle = 'rgba(30, 20, 10, 0.3)';
      const craterCount = a.size === 'large' ? 3 : a.size === 'medium' ? 2 : 1;
      for (let i = 0; i < craterCount; i++) {
        const cx = (i * 137 % 7 - 3) * (a.radius * 0.15);
        const cy = (i * 89 % 5 - 2) * (a.radius * 0.15);
        const cr = a.radius * (0.1 + (i * 53 % 3) * 0.05);
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Outline glow
      ctx.shadowColor = 'rgba(180, 150, 100, 0.3)';
      ctx.shadowBlur = 4;
      ctx.strokeStyle = 'rgba(160, 140, 100, 0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(a.vertices[0].x, a.vertices[0].y);
      for (let i = 1; i < a.vertices.length; i++) {
        ctx.lineTo(a.vertices[i].x, a.vertices[i].y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.restore();
    };

    const drawBullet = (ctx: CanvasRenderingContext2D, b: Bullet) => {
      // Glowing trail
      const trailGrad = ctx.createRadialGradient(b.pos.x, b.pos.y, 0, b.pos.x, b.pos.y, 8);
      trailGrad.addColorStop(0, 'rgba(100, 200, 255, 0.6)');
      trailGrad.addColorStop(0.4, 'rgba(50, 150, 255, 0.2)');
      trailGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = trailGrad;
      ctx.beginPath();
      ctx.arc(b.pos.x, b.pos.y, 8, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.shadowColor = '#66ccff';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.pos.x, b.pos.y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Inner glow
      ctx.fillStyle = '#aaddff';
      ctx.beginPath();
      ctx.arc(b.pos.x, b.pos.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    const drawParticles = (ctx: CanvasRenderingContext2D, particles: Particle[]) => {
      for (const p of particles) {
        const alpha = p.life / p.maxLife;
        const color = p.color || '#ffcc66';
        // Parse color to add alpha
        if (color.startsWith('#')) {
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        } else {
          ctx.fillStyle = `rgba(255, 200, 100, ${alpha})`;
        }
        const size = (p.size || 1.5) * (0.3 + alpha * 0.7);
        ctx.shadowColor = color;
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    };

    const loop = (time: number) => {
      const s = stateRef.current!;
      if (s.gameOver) return;

      const dt = s.lastTime ? Math.min((time - s.lastTime) / 16.67, 3) : 1;
      s.lastTime = time;

      // Death flash freeze
      if (s.deathFlash > 0) {
        s.deathFlash -= dt;
        // Update particles during flash so explosion plays out
        s.particles = s.particles.filter(p => {
          p.pos.x += p.vel.x * dt;
          p.pos.y += p.vel.y * dt;
          p.life -= dt;
          return p.life > 0;
        });
        draw(ctx, s);
        const flashAlpha = Math.max(0, (s.deathFlash / 30)) * 0.5;
        if (s.deathFlash > 20) {
          ctx.fillStyle = `rgba(255,255,255,${flashAlpha * 0.6})`;
        } else {
          ctx.fillStyle = `rgba(255,0,0,${flashAlpha})`;
        }
        ctx.fillRect(0, 0, BASE_W, BASE_H);
        s.animFrame = requestAnimationFrame(loop);
        return;
      }

      const keys = keysRef.current;
      const touch = touchRef.current;

      // Respawn timer
      if (s.respawnTimer > 0) {
        s.respawnTimer -= dt;
        if (s.respawnTimer <= 0) {
          s.ship = initShip();
        }
      }

      if (s.respawnTimer <= 0) {
        // Input
        const rotSpeed = 0.065 * dt;
        if (keys.has('ArrowLeft') || keys.has('a') || touch.left) s.ship.angle -= rotSpeed;
        if (keys.has('ArrowRight') || keys.has('d') || touch.right) s.ship.angle += rotSpeed;

        s.ship.thrusting = keys.has('ArrowUp') || keys.has('w') || touch.thrust;
        if (s.ship.thrusting) {
          const thrust = 0.1 * dt;
          s.ship.vel.x += Math.cos(s.ship.angle) * thrust;
          s.ship.vel.y += Math.sin(s.ship.angle) * thrust;
        }

        // Friction
        s.ship.vel.x *= 0.995;
        s.ship.vel.y *= 0.995;

        // Speed limit
        const spd = Math.hypot(s.ship.vel.x, s.ship.vel.y);
        if (spd > 6) {
          s.ship.vel.x = (s.ship.vel.x / spd) * 6;
          s.ship.vel.y = (s.ship.vel.y / spd) * 6;
        }

        // Move ship
        s.ship.pos.x += s.ship.vel.x * dt;
        s.ship.pos.y += s.ship.vel.y * dt;
        wrap(s.ship.pos);

        // Shooting
        s.shootCooldown -= dt;
        if ((keys.has(' ') || touch.shoot) && s.shootCooldown <= 0 && s.bullets.length < 8) {
          s.bullets.push({
            pos: {
              x: s.ship.pos.x + Math.cos(s.ship.angle) * 16,
              y: s.ship.pos.y + Math.sin(s.ship.angle) * 16,
            },
            vel: {
              x: Math.cos(s.ship.angle) * 7 + s.ship.vel.x * 0.3,
              y: Math.sin(s.ship.angle) * 7 + s.ship.vel.y * 0.3,
            },
            life: 50,
          });
          s.shootCooldown = 8;
        }

        // Invincibility
        if (s.ship.invincibleTimer > 0) s.ship.invincibleTimer -= dt;
      }

      // Shield flash decay
      if (s.shieldFlash > 0) s.shieldFlash -= dt;

      // Update bullets
      s.bullets = s.bullets.filter(b => {
        b.pos.x += b.vel.x * dt;
        b.pos.y += b.vel.y * dt;
        b.life -= dt;
        wrap(b.pos);
        return b.life > 0;
      });

      // Update asteroids
      for (const a of s.asteroids) {
        a.pos.x += a.vel.x * dt;
        a.pos.y += a.vel.y * dt;
        a.rotation += a.rotSpeed * dt;
        wrap(a.pos);
      }

      // Update particles
      s.particles = s.particles.filter(p => {
        p.pos.x += p.vel.x * dt;
        p.pos.y += p.vel.y * dt;
        p.life -= dt;
        return p.life > 0;
      });

      // Bullet-asteroid collisions
      const newAsteroids: Asteroid[] = [];
      s.asteroids = s.asteroids.filter(a => {
        for (let i = s.bullets.length - 1; i >= 0; i--) {
          if (dist(s.bullets[i].pos, a.pos) < a.radius + 4) {
            s.bullets.splice(i, 1);

            // Explosion particles
            spawnExplosion(a.pos, a.size === 'large' ? 16 : a.size === 'medium' ? 10 : 6, false);

            // Score
            const pts = { large: 20, medium: 50, small: 100 };
            s.score += pts[a.size];
            setDisplayScore(s.score);

            // Extra life check
            if (s.score >= s.nextExtraLife && s.lives < MAX_LIVES) {
              s.lives++;
              s.nextExtraLife += EXTRA_LIFE_INTERVAL;
              s.extraLifeFlash = 60;
              setDisplayLives(s.lives);
            }

            // Break apart
            if (a.size === 'large') {
              newAsteroids.push(spawnAsteroid('medium', { ...a.pos }));
              newAsteroids.push(spawnAsteroid('medium', { ...a.pos }));
            } else if (a.size === 'medium') {
              newAsteroids.push(spawnAsteroid('small', { ...a.pos }));
              newAsteroids.push(spawnAsteroid('small', { ...a.pos }));
            }

            return false;
          }
        }
        return true;
      });
      s.asteroids.push(...newAsteroids);

      // Ship-asteroid collision
      if (s.respawnTimer <= 0 && s.ship.invincibleTimer <= 0) {
        for (const a of s.asteroids) {
          if (dist(s.ship.pos, a.pos) < a.radius + 12) {
            // Death explosion
            spawnExplosion(s.ship.pos, 25, true);
            s.shieldFlash = 15;

            s.lives--;
            setDisplayLives(s.lives);

            if (s.lives <= 0) {
              s.gameOver = true;
              draw(ctx, s);
              setTimeout(() => onGameOver(s.score), 1500);
              return;
            }

            s.respawnTimer = 60;
            s.deathFlash = 30;
            break;
          }
        }
      }

      // Next wave
      if (s.asteroids.length === 0) {
        s.wave++;
        s.asteroids = spawnWave(s.wave);
      }

      draw(ctx, s);
      s.animFrame = requestAnimationFrame(loop);
    };

    const draw = (ctx: CanvasRenderingContext2D, s: NonNullable<typeof stateRef.current>) => {
      drawBackground(ctx, s);

      // Asteroids
      for (const a of s.asteroids) {
        drawAsteroid(ctx, a);
      }

      // Bullets
      for (const b of s.bullets) {
        drawBullet(ctx, b);
      }

      // Particles
      drawParticles(ctx, s.particles);

      // Ship
      if (s.respawnTimer <= 0) {
        const ship = s.ship;

        if (ship.invincibleTimer > 0) {
          const t = Date.now() * 0.01;
          ctx.save();
          ctx.globalAlpha = 0.4 + Math.sin(t) * 0.4;
          drawShip(ctx, ship);
          // Glow ring
          ctx.strokeStyle = '#5599ff';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#5599ff';
          ctx.shadowBlur = 15 + Math.sin(t * 2) * 10;
          ctx.beginPath();
          ctx.arc(ship.pos.x, ship.pos.y, 22, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else {
          drawShip(ctx, ship);
        }
      }

      // 1UP flash
      if (s.extraLifeFlash > 0) {
        s.extraLifeFlash--;
        ctx.save();
        ctx.globalAlpha = Math.max(0, s.extraLifeFlash / 60);
        ctx.fillStyle = '#00ff88';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 20;
        ctx.font = 'bold 28px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('1UP!', BASE_W / 2, BASE_H / 2 - 40);
        ctx.restore();
      }

      // Game over text
      if (s.gameOver) {
        // Overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, BASE_W, BASE_H);

        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 40px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', BASE_W / 2, BASE_H / 2 - 10);
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = '20px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(`SCORE: ${s.score}`, BASE_W / 2, BASE_H / 2 + 30);
      }
    };

    stateRef.current.animFrame = requestAnimationFrame(loop);
    const ref = stateRef.current;

    return () => {
      if (ref) cancelAnimationFrame(ref.animFrame);
    };
  }, [spawnWave, onGameOver]);

  // Touch button handlers
  const setTouch = (key: keyof typeof touchRef.current, value: boolean) => {
    touchRef.current[key] = value;
  };

  const touchBtnClass = 'w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-2xl font-bold select-none active:scale-90 transition-transform';

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <h2 className="text-xl font-bold text-white tracking-wider">ASTEROIDS</h2>

      <div className="flex items-center justify-between w-full max-w-[600px] px-4">
        <div className="text-white font-mono font-bold text-lg">
          {displayScore}
        </div>
        <div className="text-white font-mono text-sm flex gap-1 items-center">
          {displayLives === 1 ? (
            <span className="text-red-500 font-bold text-xs animate-pulse">LAST LIFE</span>
          ) : (
            Array.from({ length: Math.max(0, displayLives - 1) }, (_, i) => (
              <svg key={i} width="16" height="16" viewBox="0 0 16 16" className="fill-none stroke-white" strokeWidth="1.5">
                <path d="M8 1 L14 13 L8 10 L2 13 Z" />
              </svg>
            ))
          )}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        style={{ width: canvasSize.w, height: canvasSize.h }}
        className="rounded-lg border border-zinc-800 touch-none"
      />

      {/* Touch controls */}
      <div className="flex items-center justify-between w-full max-w-[400px] px-4 sm:hidden mt-1">
        <div className="flex gap-2">
          <button
            className={`${touchBtnClass} bg-zinc-800 border border-zinc-600 text-zinc-300`}
            onTouchStart={() => setTouch('left', true)}
            onTouchEnd={() => setTouch('left', false)}
            onContextMenu={e => e.preventDefault()}
          >
            ◀
          </button>
          <button
            className={`${touchBtnClass} bg-zinc-800 border border-zinc-600 text-zinc-300`}
            onTouchStart={() => setTouch('right', true)}
            onTouchEnd={() => setTouch('right', false)}
            onContextMenu={e => e.preventDefault()}
          >
            ▶
          </button>
        </div>
        <button
          className={`${touchBtnClass} bg-orange-900/60 border border-orange-600 text-orange-300`}
          onTouchStart={() => setTouch('thrust', true)}
          onTouchEnd={() => setTouch('thrust', false)}
          onContextMenu={e => e.preventDefault()}
        >
          ▲
        </button>
        <button
          className={`${touchBtnClass} bg-red-900/60 border border-red-600 text-red-300`}
          onTouchStart={() => setTouch('shoot', true)}
          onTouchEnd={() => setTouch('shoot', false)}
          onContextMenu={e => e.preventDefault()}
        >
          ●
        </button>
      </div>

      <p className="text-zinc-500 text-xs mt-1">
        Arrows to move | Space to shoot
      </p>
    </div>
  );
}
