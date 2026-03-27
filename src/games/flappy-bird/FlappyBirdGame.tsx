'use client';

import { useRef, useEffect, useCallback } from 'react';
import { playMove, playPickup, playDeath, playGameOver } from '@/lib/sounds';

interface FlappyBirdGameProps {
  onGameOver: (score: number) => void;
  level: 'easy' | 'medium' | 'hard';
}

const W = 400;
const H = 600;
const PIPE_W = 52;
const BIRD_SIZE = 20;
const GROUND_H = 60;

interface Pipe { x: number; gapY: number; scored: boolean; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number; rotation: number; rotSpeed: number; }
interface Cloud { x: number; y: number; w: number; opacity: number; speed: number; }

export default function FlappyBirdGame({ onGameOver, level }: FlappyBirdGameProps) {
  // Difficulty settings
  const GRAVITY = level === 'easy' ? 0.35 : level === 'hard' ? 0.55 : 0.45;
  const FLAP_FORCE = level === 'easy' ? -7 : level === 'hard' ? -8.5 : -7.5;
  const PIPE_GAP = level === 'easy' ? 180 : level === 'hard' ? 90 : 150;
  const PIPE_SPEED = level === 'easy' ? 2 : level === 'hard' ? 3.5 : 2.5;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    birdY: H / 2,
    birdVy: 0,
    birdAngle: 0,
    pipes: [] as Pipe[],
    score: 0,
    gameOver: false,
    gameOverNotified: false,
    started: false,
    pipeTimer: 0,
    wingUp: true,
    wingTimer: 0,
    groundOffset: 0,
    particles: [] as Particle[],
    clouds: [] as Cloud[],
    flapParticleTimer: 0,
  });

  const flap = useCallback(() => {
    const s = stateRef.current;
    if (s.gameOver) return;
    if (!s.started) {
      s.started = true;
    }
    s.birdVy = FLAP_FORCE;
    playMove();
    // Spawn flap particles
    for (let i = 0; i < 3; i++) {
      s.particles.push({
        x: 80 - BIRD_SIZE,
        y: s.birdY + (Math.random() - 0.5) * 10,
        vx: -1 - Math.random() * 2,
        vy: (Math.random() - 0.5) * 2,
        life: 1,
        color: '#ffffff',
        size: 1.5 + Math.random() * 2,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
      });
    }
  }, [FLAP_FORCE]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const s = stateRef.current;
    // Reset
    s.birdY = H / 2;
    s.birdVy = 0;
    s.birdAngle = 0;
    s.pipes = [];
    s.score = 0;
    s.gameOver = false;
    s.gameOverNotified = false;
    s.started = false;
    s.pipeTimer = 0;
    s.wingUp = true;
    s.wingTimer = 0;
    s.groundOffset = 0;
    s.particles = [];
    s.flapParticleTimer = 0;

    // Init clouds
    s.clouds = [];
    for (let i = 0; i < 6; i++) {
      s.clouds.push({
        x: Math.random() * W,
        y: 30 + Math.random() * 150,
        w: 40 + Math.random() * 60,
        opacity: 0.15 + Math.random() * 0.25,
        speed: 0.2 + Math.random() * 0.4,
      });
    }

    canvas.width = W;
    canvas.height = H;

    const BIRD_X = 80;

    function drawBird(x: number, y: number) {
      if (!ctx) return;
      ctx.save();
      ctx.translate(x, y);
      const angle = Math.min(Math.max(s.birdVy * 3, -30), 70) * Math.PI / 180;
      ctx.rotate(angle);

      // Drop shadow
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(2, 3, BIRD_SIZE, BIRD_SIZE * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Body gradient
      const bodyGrad = ctx.createRadialGradient(-3, -4, 2, 0, 0, BIRD_SIZE);
      bodyGrad.addColorStop(0, '#ffe066');
      bodyGrad.addColorStop(0.5, '#f7dc6f');
      bodyGrad.addColorStop(1, '#d4a517');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, BIRD_SIZE, BIRD_SIZE * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();

      // Subtle outline
      ctx.strokeStyle = 'rgba(150,100,0,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Belly highlight
      const bellyGrad = ctx.createRadialGradient(4, 4, 1, 4, 4, BIRD_SIZE * 0.5);
      bellyGrad.addColorStop(0, '#fff8e0');
      bellyGrad.addColorStop(1, 'rgba(253,235,208,0)');
      ctx.fillStyle = bellyGrad;
      ctx.beginPath();
      ctx.ellipse(4, 4, BIRD_SIZE * 0.5, BIRD_SIZE * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wing with gradient
      const wingGrad = ctx.createLinearGradient(-16, -6, -16, 10);
      wingGrad.addColorStop(0, '#f0b429');
      wingGrad.addColorStop(1, '#c48a12');
      ctx.fillStyle = wingGrad;
      const wingY = s.wingUp ? -8 : 5;
      ctx.beginPath();
      ctx.ellipse(-4, wingY, 13, 7, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,100,0,0.2)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Eye (white with subtle gradient)
      const eyeGrad = ctx.createRadialGradient(9, -7, 1, 10, -6, 7);
      eyeGrad.addColorStop(0, '#ffffff');
      eyeGrad.addColorStop(1, '#e8e8e8');
      ctx.fillStyle = eyeGrad;
      ctx.beginPath();
      ctx.arc(10, -6, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Pupil
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.arc(12, -5, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Eye highlight
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(13, -7, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Eyebrow for expression
      if (s.gameOver) {
        ctx.strokeStyle = '#5a3000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(6, -12);
        ctx.lineTo(14, -11);
        ctx.stroke();
      }

      // Beak gradient
      const beakGrad = ctx.createLinearGradient(16, -2, 26, 4);
      beakGrad.addColorStop(0, '#ff6b3d');
      beakGrad.addColorStop(1, '#cc3311');
      ctx.fillStyle = beakGrad;
      ctx.beginPath();
      ctx.moveTo(16, -2);
      ctx.quadraticCurveTo(28, 1, 16, 6);
      ctx.closePath();
      ctx.fill();

      // Top beak shine
      ctx.fillStyle = 'rgba(255,200,150,0.4)';
      ctx.beginPath();
      ctx.moveTo(16, -1);
      ctx.quadraticCurveTo(24, 0, 16, 2);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    function drawPipe(x: number, gapY: number) {
      if (!ctx) return;
      const topH = gapY - PIPE_GAP / 2;
      const botY = gapY + PIPE_GAP / 2;

      // Top pipe - metallic gradient
      const pipeGrad = ctx.createLinearGradient(x, 0, x + PIPE_W, 0);
      pipeGrad.addColorStop(0, '#1a3a4a');
      pipeGrad.addColorStop(0.15, '#2a6a7a');
      pipeGrad.addColorStop(0.35, '#4aaaba');
      pipeGrad.addColorStop(0.5, '#2a7a8a');
      pipeGrad.addColorStop(0.7, '#1a5a6a');
      pipeGrad.addColorStop(1, '#0a2a3a');
      ctx.fillStyle = pipeGrad;

      // Top pipe body with rounded bottom
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + PIPE_W, 0);
      ctx.lineTo(x + PIPE_W, topH - 4);
      ctx.quadraticCurveTo(x + PIPE_W, topH, x + PIPE_W - 4, topH);
      ctx.lineTo(x + 4, topH);
      ctx.quadraticCurveTo(x, topH, x, topH - 4);
      ctx.closePath();
      ctx.fill();

      // Top cap
      const capGrad = ctx.createLinearGradient(x - 4, 0, x + PIPE_W + 4, 0);
      capGrad.addColorStop(0, '#1a4a5a');
      capGrad.addColorStop(0.2, '#3a8a9a');
      capGrad.addColorStop(0.4, '#5abaca');
      capGrad.addColorStop(0.6, '#3a9aaa');
      capGrad.addColorStop(0.8, '#2a6a7a');
      capGrad.addColorStop(1, '#0a3a4a');
      ctx.fillStyle = capGrad;

      // Rounded cap
      const capR = 4;
      ctx.beginPath();
      ctx.moveTo(x - 4 + capR, topH - 26);
      ctx.lineTo(x + PIPE_W + 4 - capR, topH - 26);
      ctx.quadraticCurveTo(x + PIPE_W + 4, topH - 26, x + PIPE_W + 4, topH - 26 + capR);
      ctx.lineTo(x + PIPE_W + 4, topH - capR);
      ctx.quadraticCurveTo(x + PIPE_W + 4, topH, x + PIPE_W + 4 - capR, topH);
      ctx.lineTo(x - 4 + capR, topH);
      ctx.quadraticCurveTo(x - 4, topH, x - 4, topH - capR);
      ctx.lineTo(x - 4, topH - 26 + capR);
      ctx.quadraticCurveTo(x - 4, topH - 26, x - 4 + capR, topH - 26);
      ctx.closePath();
      ctx.fill();

      // Cap shine
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x - 2, topH - 24, (PIPE_W + 8) * 0.35, 20);

      // Edge glow on top pipe
      ctx.save();
      ctx.shadowColor = 'rgba(80,200,220,0.3)';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(80,200,220,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 4, topH);
      ctx.lineTo(x + PIPE_W + 4, topH);
      ctx.stroke();
      ctx.restore();

      // Bottom pipe body
      ctx.fillStyle = pipeGrad;
      ctx.beginPath();
      ctx.moveTo(x + 4, botY);
      ctx.quadraticCurveTo(x, botY, x, botY + 4);
      ctx.lineTo(x, H - GROUND_H);
      ctx.lineTo(x + PIPE_W, H - GROUND_H);
      ctx.lineTo(x + PIPE_W, botY + 4);
      ctx.quadraticCurveTo(x + PIPE_W, botY, x + PIPE_W - 4, botY);
      ctx.closePath();
      ctx.fill();

      // Bottom cap
      ctx.fillStyle = capGrad;
      ctx.beginPath();
      ctx.moveTo(x - 4 + capR, botY);
      ctx.lineTo(x + PIPE_W + 4 - capR, botY);
      ctx.quadraticCurveTo(x + PIPE_W + 4, botY, x + PIPE_W + 4, botY + capR);
      ctx.lineTo(x + PIPE_W + 4, botY + 26 - capR);
      ctx.quadraticCurveTo(x + PIPE_W + 4, botY + 26, x + PIPE_W + 4 - capR, botY + 26);
      ctx.lineTo(x - 4 + capR, botY + 26);
      ctx.quadraticCurveTo(x - 4, botY + 26, x - 4, botY + 26 - capR);
      ctx.lineTo(x - 4, botY + capR);
      ctx.quadraticCurveTo(x - 4, botY, x - 4 + capR, botY);
      ctx.closePath();
      ctx.fill();

      // Cap shine
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x - 2, botY + 2, (PIPE_W + 8) * 0.35, 20);

      // Edge glow on bottom pipe
      ctx.save();
      ctx.shadowColor = 'rgba(80,200,220,0.3)';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = 'rgba(80,200,220,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 4, botY);
      ctx.lineTo(x + PIPE_W + 4, botY);
      ctx.stroke();
      ctx.restore();

      // Pipe center highlight line
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(x + PIPE_W * 0.15, 0, PIPE_W * 0.15, topH - 26);
      ctx.fillRect(x + PIPE_W * 0.15, botY + 26, PIPE_W * 0.15, H - GROUND_H - botY - 26);
    }

    function drawGround() {
      if (!ctx) return;
      const groundY = H - GROUND_H;

      // Ground gradient
      const groundGrad = ctx.createLinearGradient(0, groundY, 0, H);
      groundGrad.addColorStop(0, '#3a7a30');
      groundGrad.addColorStop(0.05, '#5a9a40');
      groundGrad.addColorStop(0.15, '#7ab850');
      groundGrad.addColorStop(0.2, '#6aaa42');
      groundGrad.addColorStop(0.35, '#8a6a3a');
      groundGrad.addColorStop(0.6, '#7a5a2a');
      groundGrad.addColorStop(1, '#5a4020');
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, groundY, W, GROUND_H);

      // Grass blades on top
      ctx.fillStyle = '#5aaa35';
      for (let i = -1; i < W / 8 + 2; i++) {
        const gx = ((i * 8 + s.groundOffset * 1.5) % (W + 20)) - 10;
        ctx.beginPath();
        ctx.moveTo(gx, groundY + 2);
        ctx.lineTo(gx + 3, groundY - 4);
        ctx.lineTo(gx + 6, groundY + 2);
        ctx.closePath();
        ctx.fill();
      }

      // Ground pattern - subtle texture lines
      ctx.strokeStyle = 'rgba(90,60,20,0.2)';
      ctx.lineWidth = 1;
      for (let i = -1; i < W / 20 + 2; i++) {
        const gx = ((i * 20 + s.groundOffset) % (W + 40)) - 20;
        ctx.beginPath();
        ctx.moveTo(gx, groundY + 25);
        ctx.lineTo(gx + 10, groundY + 35);
        ctx.stroke();
      }

      // Top edge of ground - thin highlight
      ctx.strokeStyle = 'rgba(140,200,80,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(W, groundY);
      ctx.stroke();
    }

    function drawSky() {
      if (!ctx) return;
      // Deep gradient sky
      const grad = ctx.createLinearGradient(0, 0, 0, H - GROUND_H);
      grad.addColorStop(0, '#0a1628');
      grad.addColorStop(0.3, '#1a3050');
      grad.addColorStop(0.6, '#2a5070');
      grad.addColorStop(0.8, '#4a80a0');
      grad.addColorStop(1, '#8ab8d0');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H - GROUND_H);

      // Horizon warm glow
      const horizonGrad = ctx.createLinearGradient(0, H - GROUND_H - 80, 0, H - GROUND_H);
      horizonGrad.addColorStop(0, 'rgba(255,180,100,0)');
      horizonGrad.addColorStop(0.5, 'rgba(255,150,80,0.12)');
      horizonGrad.addColorStop(1, 'rgba(255,120,60,0.2)');
      ctx.fillStyle = horizonGrad;
      ctx.fillRect(0, H - GROUND_H - 80, W, 80);

      // Soft blurred clouds
      for (const cloud of s.clouds) {
        cloud.x -= cloud.speed;
        if (cloud.x + cloud.w < -20) {
          cloud.x = W + 20;
          cloud.y = 30 + Math.random() * 150;
        }
        ctx.save();
        ctx.globalAlpha = cloud.opacity;
        ctx.fillStyle = '#ffffff';
        ctx.filter = 'blur(6px)';

        const cx = cloud.x;
        const cy = cloud.y;
        const cw = cloud.w;
        ctx.beginPath();
        ctx.ellipse(cx, cy, cw * 0.5, cw * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + cw * 0.2, cy - cw * 0.08, cw * 0.3, cw * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx - cw * 0.15, cy + cw * 0.04, cw * 0.25, cw * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.filter = 'none';
        ctx.restore();
      }

      // Distant stars (subtle, near top)
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (let i = 0; i < 15; i++) {
        const sx = (i * 97 + 13) % W;
        const sy = (i * 31 + 5) % (H * 0.3);
        const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(Date.now() * 0.001 + i));
        ctx.save();
        ctx.globalAlpha = twinkle * 0.5;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    function updateParticles() {
      s.particles = s.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.rotation += p.rotSpeed;
        p.life -= 0.03;
        return p.life > 0;
      });
    }

    function drawParticles() {
      if (!ctx) return;
      for (const p of s.particles) {
        ctx.save();
        ctx.globalAlpha = p.life * 0.7;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 4;
        // Draw as small feather/sparkle
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    function spawnDeathParticles() {
      // Feather particles on death
      const featherColors = ['#f7dc6f', '#f0b429', '#fdebd0', '#fff8e0', '#e74c3c'];
      for (let i = 0; i < 15; i++) {
        s.particles.push({
          x: BIRD_X,
          y: s.birdY,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 5 - 2,
          life: 1,
          color: featherColors[Math.floor(Math.random() * featherColors.length)],
          size: 2 + Math.random() * 4,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.3,
        });
      }
    }

    function draw() {
      if (!ctx) return;
      drawSky();

      // Pipes
      for (const p of s.pipes) {
        drawPipe(p.x, p.gapY);
      }

      drawGround();

      // Particles behind/around bird
      drawParticles();

      drawBird(BIRD_X, s.birdY);

      // Score with drop shadow and glow
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = 'bold 48px sans-serif';

      // Drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillText(String(s.score), W / 2 + 2, 62);

      // Glow
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 3;
      ctx.strokeText(String(s.score), W / 2, 60);
      ctx.fillText(String(s.score), W / 2, 60);
      ctx.restore();
      ctx.textAlign = 'left';

      if (!s.started && !s.gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'bold 26px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 2;
        ctx.strokeText('TAP TO START', W / 2, H / 2);
        ctx.fillText('TAP TO START', W / 2, H / 2);
        ctx.restore();
        ctx.textAlign = 'left';
      }

      if (s.gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.textAlign = 'center';

        // GAME OVER
        ctx.font = 'bold 34px sans-serif';
        ctx.fillStyle = '#ff3344';
        ctx.shadowColor = '#ff0022';
        ctx.shadowBlur = 25;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 3;
        ctx.strokeText('GAME OVER', W / 2, H / 2 - 20);
        ctx.fillText('GAME OVER', W / 2, H / 2 - 20);

        // Score
        ctx.font = 'bold 22px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 15;
        ctx.strokeText(`Score: ${s.score}`, W / 2, H / 2 + 20);
        ctx.fillText(`Score: ${s.score}`, W / 2, H / 2 + 20);

        ctx.restore();
        ctx.textAlign = 'left';
      }
    }

    let deathTriggered = false;

    let animId = 0;
    function loop() {
      if (s.started && !s.gameOver) {
        // Physics
        s.birdVy += GRAVITY;
        s.birdY += s.birdVy;

        // Wing animation
        s.wingTimer++;
        if (s.wingTimer > 8) {
          s.wingTimer = 0;
          s.wingUp = !s.wingUp;
        }

        // Ground scroll
        s.groundOffset = (s.groundOffset - PIPE_SPEED) % 20;

        // Spawn pipes
        s.pipeTimer++;
        if (s.pipeTimer > 90) {
          s.pipeTimer = 0;
          const minY = PIPE_GAP / 2 + 40;
          const maxY = H - GROUND_H - PIPE_GAP / 2 - 40;
          const gapY = minY + Math.random() * (maxY - minY);
          s.pipes.push({ x: W + 10, gapY, scored: false });
        }

        // Move pipes
        s.pipes = s.pipes.filter(p => {
          p.x -= PIPE_SPEED;
          if (p.x + PIPE_W < 0) return false;

          // Score
          if (!p.scored && p.x + PIPE_W < BIRD_X) {
            p.scored = true;
            s.score++;
            playPickup();
          }
          return true;
        });

        // Collision detection
        const birdTop = s.birdY - BIRD_SIZE * 0.6;
        const birdBot = s.birdY + BIRD_SIZE * 0.6;
        const birdLeft = BIRD_X - BIRD_SIZE;
        const birdRight = BIRD_X + BIRD_SIZE;

        // Ground / ceiling
        if (birdBot >= H - GROUND_H || birdTop <= 0) {
          s.gameOver = true;
          s.birdY = Math.min(s.birdY, H - GROUND_H - BIRD_SIZE * 0.6);
          if (!deathTriggered) { deathTriggered = true; spawnDeathParticles(); playDeath(); playGameOver(); }
          if (!s.gameOverNotified) {
            s.gameOverNotified = true;
            setTimeout(() => onGameOver(s.score), 2500);
          }
        }

        // Pipes
        if (!s.gameOver) {
          for (const p of s.pipes) {
            if (birdRight > p.x && birdLeft < p.x + PIPE_W) {
              const topPipeBottom = p.gapY - PIPE_GAP / 2;
              const botPipeTop = p.gapY + PIPE_GAP / 2;
              if (birdTop < topPipeBottom || birdBot > botPipeTop) {
                s.gameOver = true;
                if (!deathTriggered) { deathTriggered = true; spawnDeathParticles(); playDeath(); playGameOver(); }
                if (!s.gameOverNotified) {
                  s.gameOverNotified = true;
                  setTimeout(() => onGameOver(s.score), 2500);
                }
                break;
              }
            }
          }
        }

        // Subtle trail particles while flying
        s.flapParticleTimer++;
        if (s.flapParticleTimer > 6 && s.birdVy < -1) {
          s.flapParticleTimer = 0;
          s.particles.push({
            x: BIRD_X - BIRD_SIZE * 0.8,
            y: s.birdY + (Math.random() - 0.5) * 6,
            vx: -0.5 - Math.random(),
            vy: (Math.random() - 0.5),
            life: 0.6,
            color: 'rgba(255,255,255,0.5)',
            size: 1 + Math.random(),
            rotation: 0,
            rotSpeed: 0,
          });
        }
      } else if (!s.started) {
        // Idle bob
        s.birdY = H / 2 + Math.sin(Date.now() / 300) * 8;
        s.wingTimer++;
        if (s.wingTimer > 8) { s.wingTimer = 0; s.wingUp = !s.wingUp; }
      }

      updateParticles();
      draw();
      animId = requestAnimationFrame(loop);
    }
    animId = requestAnimationFrame(loop);

    function handleKey(e: KeyboardEvent) {
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        flap();
      }
    }

    function handleClick() {
      flap();
    }

    function handleTouchStart(e: TouchEvent) {
      e.preventDefault();
      flap();
    }

    window.addEventListener('keydown', handleKey);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', handleKey);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('touchstart', handleTouchStart);
    };
  }, [onGameOver, flap]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <canvas
        ref={canvasRef}
        style={{
          maxWidth: '400px',
          width: '100%',
          height: 'auto',
          borderRadius: '12px',
          border: '2px solid rgba(100,150,200,0.3)',
          boxShadow: '0 0 30px rgba(0,80,150,0.2)',
        }}
      />
    </div>
  );
}
