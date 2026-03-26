'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { playSound, playBgm, stopBgm } from '@/lib/audio';

interface CrossyRoadGameProps {
  onGameOver: (score: number) => void;
  level: 'easy' | 'medium' | 'hard';
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface Lane {
  type: 'grass' | 'road' | 'water';
  // For road: cars array; for water: logs array
  obstacles: { x: number; width: number; color: string }[];
  speed: number; // pixels per second, negative = left
  row: number; // world row index
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

interface GameState {
  playerX: number; // grid column
  playerY: number; // world row (increases upward)
  targetX: number;
  targetY: number;
  animProgress: number; // 0-1 hop animation
  isHopping: boolean;
  lanes: Lane[];
  lowestGeneratedRow: number;
  highestGeneratedRow: number;
  cameraY: number; // world row the camera centers on
  score: number;
  highestRow: number;
  gameOver: boolean;
  bgmStarted: boolean;
  cellSize: number;
  cols: number;
  lastTime: number;
  onLogIndex: number; // -1 if not on a log
  onLogSpeed: number;
  playerPixelX: number; // exact pixel X when riding log
  particles: Particle[];
  deathType: 'car' | 'water' | null;
}

const COLS = 13;
const HOP_DURATION = 0.1; // seconds
const VISIBLE_ROWS = 16;

const CAR_COLORS = [
  ['#ff3366', '#cc0044'], // neon pink
  ['#ff6633', '#cc3300'], // neon orange
  ['#ffcc00', '#cc9900'], // neon gold
  ['#cc44ff', '#9900cc'], // neon purple
  ['#00ffcc', '#00cc99'], // neon teal
  ['#3399ff', '#0066cc'], // neon blue
];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

interface DifficultyParams {
  carSpeedMult: number;
  gapMult: number;
  logCountBonus: number;
  grassChance: number;
  roadChance: number;
  carCountMod: number;
}

function generateLane(row: number, cols: number, cellSize: number, diff?: DifficultyParams): Lane {
  const d = diff || { carSpeedMult: 1, gapMult: 1, logCountBonus: 0, grassChance: 0.35, roadChance: 0.7, carCountMod: 0 };

  if (row <= 0) {
    return { type: 'grass', obstacles: [], speed: 0, row };
  }

  // Increase difficulty with row
  const difficulty = Math.min(row / 50, 1);
  const rand = Math.random();

  // First 2 rows always grass for breathing room
  if (row <= 2) {
    return { type: 'grass', obstacles: [], speed: 0, row };
  }

  if (rand < d.grassChance) {
    // Grass - safe
    return { type: 'grass', obstacles: [], speed: 0, row };
  } else if (rand < d.roadChance) {
    // Road with cars
    const dir = Math.random() < 0.5 ? 1 : -1;
    const baseSpeed = (40 + Math.random() * 60 + difficulty * 40) * d.carSpeedMult * dir;
    const carCount = Math.max(1, 2 + Math.floor(Math.random() * 2 + difficulty) + d.carCountMod);
    const carWidth = cellSize * (1.5 + Math.random() * 1.5) * d.gapMult;
    const totalWidth = cols * cellSize;
    const obstacles: { x: number; width: number; color: string }[] = [];
    const spacing = totalWidth / carCount;

    for (let i = 0; i < carCount; i++) {
      obstacles.push({
        x: i * spacing + Math.random() * spacing * 0.3,
        width: carWidth,
        color: String(Math.floor(Math.random() * CAR_COLORS.length)),
      });
    }

    return { type: 'road', obstacles, speed: baseSpeed, row };
  } else {
    // Water with logs
    const dir = Math.random() < 0.5 ? 1 : -1;
    const baseSpeed = (25 + Math.random() * 35 + difficulty * 20) * d.carSpeedMult * dir;
    const logCount = Math.max(1, 2 + Math.floor(Math.random() * 2) + d.logCountBonus);
    const logWidth = cellSize * (2 + Math.random() * 2);
    const totalWidth = cols * cellSize;
    const obstacles: { x: number; width: number; color: string }[] = [];
    const spacing = totalWidth / logCount;

    for (let i = 0; i < logCount; i++) {
      obstacles.push({
        x: i * spacing + Math.random() * spacing * 0.2,
        width: logWidth,
        color: '#8B5E3C',
      });
    }

    return { type: 'water', obstacles, speed: baseSpeed, row };
  }
}

export default function CrossyRoadGame({ onGameOver, level }: CrossyRoadGameProps) {
  // Difficulty settings
  const difficultyConfig = {
    easy:   { carSpeedMult: 0.6, gapMult: 0.7, logCountBonus: 1, grassChance: 0.5, roadChance: 0.75, carCountMod: -1 },
    medium: { carSpeedMult: 1.0, gapMult: 1.0, logCountBonus: 0, grassChance: 0.35, roadChance: 0.7, carCountMod: 0 },
    hard:   { carSpeedMult: 1.4, gapMult: 1.3, logCountBonus: -1, grassChance: 0.2, roadChance: 0.65, carCountMod: 1 },
  }[level];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const animFrameRef = useRef<number>(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const gameOverCalledRef = useRef(false);
  const inputQueueRef = useRef<Direction[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 400 });

  const getCanvasSize = useCallback(() => {
    const maxW = Math.min(window.innerWidth - 32, 400);
    const maxH = Math.min(window.innerHeight - 120, 600);
    const cellSize = Math.floor(maxW / COLS);
    const width = cellSize * COLS;
    const rows = Math.floor(maxH / cellSize);
    const height = rows * cellSize;
    return { width, height, cellSize, rows };
  }, []);

  const initGame = useCallback(() => {
    const { width, height, cellSize } = getCanvasSize();
    setCanvasSize({ width, height });

    const lanes: Lane[] = [];
    for (let r = -2; r <= VISIBLE_ROWS + 5; r++) {
      lanes.push(generateLane(r, COLS, cellSize, difficultyConfig));
    }

    gameRef.current = {
      playerX: Math.floor(COLS / 2),
      playerY: 0,
      targetX: Math.floor(COLS / 2),
      targetY: 0,
      animProgress: 1,
      isHopping: false,
      lanes,
      lowestGeneratedRow: -2,
      highestGeneratedRow: VISIBLE_ROWS + 5,
      cameraY: 0,
      score: 0,
      highestRow: 0,
      gameOver: false,
      bgmStarted: false,
      cellSize,
      cols: COLS,
      lastTime: 0,
      onLogIndex: -1,
      onLogSpeed: 0,
      playerPixelX: Math.floor(COLS / 2) * cellSize + cellSize / 2,
      particles: [],
      deathType: null,
    };
    gameOverCalledRef.current = false;
    inputQueueRef.current = [];
  }, [getCanvasSize]);

  const tryHop = useCallback((dir: Direction) => {
    const g = gameRef.current;
    if (!g || g.gameOver || g.isHopping) {
      if (g && !g.gameOver && g.isHopping) {
        inputQueueRef.current.push(dir);
        if (inputQueueRef.current.length > 2) inputQueueRef.current.shift();
      }
      return;
    }

    let nx = g.playerX;
    let ny = g.playerY;

    // Sideways hops are 30% of a cell; forward/back is a full cell
    const sideStep = 0.3;
    if (dir === 'UP') ny += 1;
    else if (dir === 'DOWN') ny -= 1;
    else if (dir === 'LEFT') nx -= sideStep;
    else if (dir === 'RIGHT') nx += sideStep;

    if (nx < 0 || nx >= g.cols) return;
    // Don't allow going more than ~4 rows below camera
    if (ny < g.cameraY - 4) return;

    g.targetX = nx;
    g.targetY = ny;
    g.isHopping = true;
    g.animProgress = 0;
    g.onLogIndex = -1;
    if (!g.bgmStarted) { g.bgmStarted = true; playBgm('bgm_crossy_road.wav'); }
    playSound('crossy_hop');
  }, []);

  const getLane = useCallback((row: number): Lane | undefined => {
    const g = gameRef.current;
    if (!g) return undefined;
    return g.lanes.find(l => l.row === row);
  }, []);

  const worldToScreen = useCallback((worldX: number, worldRow: number, g: GameState, canvasHeight: number) => {
    const screenX = worldX;
    const screenY = canvasHeight - (worldRow - g.cameraY + 4) * g.cellSize - g.cellSize;
    return { screenX, screenY };
  }, []);

  useEffect(() => {
    initGame();

    const handleKey = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === 'ArrowUp' || e.key === 'w') tryHop('UP');
      else if (e.key === 'ArrowDown' || e.key === 's') tryHop('DOWN');
      else if (e.key === 'ArrowLeft' || e.key === 'a') tryHop('LEFT');
      else if (e.key === 'ArrowRight' || e.key === 'd') tryHop('RIGHT');
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      touchStartRef.current = { x: t.clientX, y: t.clientY };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (!touchStartRef.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartRef.current.x;
      const dy = t.clientY - touchStartRef.current.y;
      const threshold = 20;

      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
        // Tap = hop forward
        tryHop('UP');
      } else if (Math.abs(dx) > Math.abs(dy)) {
        tryHop(dx > 0 ? 'RIGHT' : 'LEFT');
      } else {
        tryHop(dy < 0 ? 'UP' : 'DOWN');
      }
      touchStartRef.current = null;
    };

    const canvas = canvasRef.current;
    window.addEventListener('keydown', handleKey);
    if (canvas) {
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    }

    return () => {
      window.removeEventListener('keydown', handleKey);
      if (canvas) {
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchend', handleTouchEnd);
      }
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [initGame, tryHop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gameLoop = (timestamp: number) => {
      const g = gameRef.current;
      if (!g) { animFrameRef.current = requestAnimationFrame(gameLoop); return; }

      if (g.lastTime === 0) g.lastTime = timestamp;
      const dt = Math.min((timestamp - g.lastTime) / 1000, 0.05);
      g.lastTime = timestamp;

      if (!g.gameOver) {
        // Update hop animation
        if (g.isHopping) {
          g.animProgress += dt / HOP_DURATION;
          if (g.animProgress >= 1) {
            g.animProgress = 1;
            g.isHopping = false;
            g.playerX = g.targetX;
            g.playerY = g.targetY;
            g.playerPixelX = g.playerX * g.cellSize + g.cellSize / 2;

            // Update score
            if (g.playerY > g.highestRow) {
              g.score += g.playerY - g.highestRow;
              g.highestRow = g.playerY;
            }

            // Process queued input
            if (inputQueueRef.current.length > 0) {
              const next = inputQueueRef.current.shift()!;
              tryHop(next);
            }
          }
        }

        // Move camera smoothly toward player
        const targetCam = g.playerY;
        g.cameraY += (targetCam - g.cameraY) * Math.min(1, dt * 6);

        // Generate new lanes if needed
        while (g.highestGeneratedRow < g.playerY + VISIBLE_ROWS + 5) {
          g.highestGeneratedRow++;
          g.lanes.push(generateLane(g.highestGeneratedRow, COLS, g.cellSize, difficultyConfig));
        }
        // Prune old lanes
        while (g.lanes.length > 0 && g.lanes[0].row < g.cameraY - 10) {
          g.lanes.shift();
        }

        // Update obstacle positions
        const totalWidth = g.cols * g.cellSize;
        for (const lane of g.lanes) {
          if (lane.type === 'grass') continue;
          for (const obs of lane.obstacles) {
            obs.x += lane.speed * dt;
            // Wrap around
            if (lane.speed > 0 && obs.x > totalWidth + obs.width) {
              obs.x = -obs.width;
            } else if (lane.speed < 0 && obs.x + obs.width < -obs.width) {
              obs.x = totalWidth + obs.width;
            }
          }
        }

        // Check if player is on a log (when not hopping)
        if (!g.isHopping) {
          const currentLane = getLane(g.playerY);
          if (currentLane && currentLane.type === 'water') {
            const px = g.playerPixelX;
            const pHalf = g.cellSize * 0.4;
            let onLog = false;
            for (const log of currentLane.obstacles) {
              if (px + pHalf > log.x && px - pHalf < log.x + log.width) {
                onLog = true;
                g.playerPixelX += currentLane.speed * dt;
                // Wrap player pixel position
                if (g.playerPixelX < -g.cellSize) g.playerPixelX = totalWidth + g.cellSize / 2;
                if (g.playerPixelX > totalWidth + g.cellSize) g.playerPixelX = -g.cellSize / 2;
                // Update grid position
                g.playerX = Math.round((g.playerPixelX - g.cellSize / 2) / g.cellSize);
                break;
              }
            }
            if (!onLog) {
              // Fell in water - spawn splash particles
              g.gameOver = true;
              g.deathType = 'water';
              playSound('crossy_game_over');
              stopBgm();
              const { screenY: sy } = worldToScreen(0, g.playerY, g, canvas.height);
              for (let i = 0; i < 20; i++) {
                g.particles.push({
                  x: g.playerPixelX + (Math.random() - 0.5) * 10,
                  y: sy + g.cellSize / 2,
                  vx: (Math.random() - 0.5) * 200,
                  vy: -Math.random() * 250 - 50,
                  life: 0.8 + Math.random() * 0.5,
                  maxLife: 0.8 + Math.random() * 0.5,
                  color: Math.random() > 0.5 ? '#00ccff' : '#66ddff',
                  size: 3 + Math.random() * 4,
                });
              }
            }
          } else if (currentLane && currentLane.type === 'road') {
            // Check car collision
            const px = g.playerX * g.cellSize + g.cellSize / 2;
            const pHalf = g.cellSize * 0.35;
            for (const car of currentLane.obstacles) {
              if (px + pHalf > car.x && px - pHalf < car.x + car.width) {
                g.gameOver = true;
                g.deathType = 'car';
                playSound('crossy_car');
                playSound('crossy_game_over');
                stopBgm();
                break;
              }
            }
          }

          // Check if player went off screen horizontally
          if (g.playerPixelX < -g.cellSize || g.playerPixelX > totalWidth + g.cellSize) {
            g.gameOver = true;
            playSound('crossy_game_over');
            stopBgm();
          }

          // Check too far below camera
          if (g.playerY < g.cameraY - 5) {
            g.gameOver = true;
            playSound('crossy_game_over');
            stopBgm();
          }
        }

        if (g.gameOver && !gameOverCalledRef.current) {
          gameOverCalledRef.current = true;
          setTimeout(() => onGameOver(g.score), 800);
        }
      }

      // Update particles
      for (let i = g.particles.length - 1; i >= 0; i--) {
        const p = g.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 400 * dt; // gravity on particles
        p.life -= dt;
        if (p.life <= 0) {
          g.particles.splice(i, 1);
        }
      }

      // --- DRAW ---
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Dark background base
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, W, H);

      // Draw lanes
      for (const lane of g.lanes) {
        const { screenY: sy } = worldToScreen(0, lane.row, g, H);
        if (sy > H + g.cellSize || sy < -g.cellSize * 2) continue;

        // Lane background
        if (lane.type === 'grass') {
          // Rich dark grass gradient
          const grassGrad = ctx.createLinearGradient(0, sy, 0, sy + g.cellSize);
          if (lane.row % 2 === 0) {
            grassGrad.addColorStop(0, '#1a3d1a');
            grassGrad.addColorStop(1, '#0f2e0f');
          } else {
            grassGrad.addColorStop(0, '#163016');
            grassGrad.addColorStop(1, '#0d260d');
          }
          ctx.fillStyle = grassGrad;
          ctx.fillRect(0, sy, W, g.cellSize);

          // Grass texture - small blades with subtle glow
          for (let i = 0; i < COLS * 2; i++) {
            const gx = (i * g.cellSize * 0.5) + Math.sin(lane.row * 3 + i) * 5;
            const gh = 3 + Math.random() * 5;
            ctx.fillStyle = `rgba(80, 200, 80, ${0.15 + Math.random() * 0.15})`;
            ctx.fillRect(gx, sy + g.cellSize - gh, 2, gh);
          }

          // Occasional tree/bush decorations
          if (lane.row % 3 === 0) {
            for (let t = 0; t < 2; t++) {
              const tx = (lane.row * 47 + t * 173) % W;
              const treeSize = g.cellSize * 0.35;
              // Tree shadow/glow
              ctx.fillStyle = 'rgba(0, 255, 100, 0.05)';
              ctx.beginPath();
              ctx.arc(tx, sy + g.cellSize * 0.4, treeSize + 4, 0, Math.PI * 2);
              ctx.fill();
              // Tree body
              const treeGrad = ctx.createRadialGradient(tx, sy + g.cellSize * 0.35, 0, tx, sy + g.cellSize * 0.35, treeSize);
              treeGrad.addColorStop(0, '#2d7a2d');
              treeGrad.addColorStop(0.7, '#1a5c1a');
              treeGrad.addColorStop(1, '#0f3f0f');
              ctx.fillStyle = treeGrad;
              ctx.beginPath();
              ctx.arc(tx, sy + g.cellSize * 0.4, treeSize, 0, Math.PI * 2);
              ctx.fill();
              // Trunk
              ctx.fillStyle = '#4a3020';
              ctx.fillRect(tx - 2, sy + g.cellSize * 0.55, 4, g.cellSize * 0.3);
            }
          }
        } else if (lane.type === 'road') {
          // Dark asphalt gradient
          const roadGrad = ctx.createLinearGradient(0, sy, 0, sy + g.cellSize);
          roadGrad.addColorStop(0, '#1a1a2e');
          roadGrad.addColorStop(0.5, '#222240');
          roadGrad.addColorStop(1, '#1a1a2e');
          ctx.fillStyle = roadGrad;
          ctx.fillRect(0, sy, W, g.cellSize);

          // Road edge glow lines
          ctx.fillStyle = 'rgba(255, 200, 50, 0.15)';
          ctx.fillRect(0, sy, W, 1);
          ctx.fillRect(0, sy + g.cellSize - 1, W, 1);

          // Dashed center line with glow
          ctx.setLineDash([g.cellSize * 0.3, g.cellSize * 0.4]);
          ctx.strokeStyle = 'rgba(255, 220, 80, 0.25)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, sy + g.cellSize / 2);
          ctx.lineTo(W, sy + g.cellSize / 2);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255, 220, 80, 0.6)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, sy + g.cellSize / 2);
          ctx.lineTo(W, sy + g.cellSize / 2);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          // Water with animated gradient
          const waterGrad = ctx.createLinearGradient(0, sy, 0, sy + g.cellSize);
          const wavePhase = timestamp / 800 + lane.row * 0.7;
          const r = Math.sin(wavePhase) * 0.1;
          waterGrad.addColorStop(0, `rgba(0, ${100 + r * 50}, ${180 + r * 30}, 1)`);
          waterGrad.addColorStop(0.5, `rgba(0, ${80 + r * 40}, ${200 + r * 20}, 1)`);
          waterGrad.addColorStop(1, `rgba(0, ${60 + r * 30}, ${160 + r * 40}, 1)`);
          ctx.fillStyle = waterGrad;
          ctx.fillRect(0, sy, W, g.cellSize);

          // Animated wave ripples with glow
          ctx.strokeStyle = 'rgba(100, 220, 255, 0.2)';
          ctx.lineWidth = 1.5;
          for (let rx = 0; rx < W; rx += g.cellSize * 0.8) {
            const waveX = rx + Math.sin(timestamp / 600 + lane.row + rx * 0.01) * 8;
            ctx.beginPath();
            ctx.arc(waveX, sy + g.cellSize * 0.4, g.cellSize * 0.25, 0, Math.PI);
            ctx.stroke();
          }
          // Secondary wave layer
          ctx.strokeStyle = 'rgba(150, 240, 255, 0.1)';
          for (let rx = g.cellSize * 0.4; rx < W; rx += g.cellSize * 0.8) {
            const waveX = rx + Math.sin(timestamp / 450 + lane.row * 2 + rx * 0.015) * 6;
            ctx.beginPath();
            ctx.arc(waveX, sy + g.cellSize * 0.65, g.cellSize * 0.2, 0, Math.PI);
            ctx.stroke();
          }
        }

        // Draw obstacles
        for (const obs of lane.obstacles) {
          const ox = obs.x;
          const oy = sy;

          if (lane.type === 'road') {
            // Sleek neon car
            const colorIdx = parseInt(obs.color) || 0;
            const [carMain, carDark] = CAR_COLORS[colorIdx % CAR_COLORS.length];
            const carH = g.cellSize * 0.65;
            const carY = oy + (g.cellSize - carH) / 2;
            const goingRight = lane.speed > 0;

            // Car glow underneath
            ctx.fillStyle = carMain.replace(')', ', 0.15)').replace('rgb', 'rgba');
            ctx.beginPath();
            ctx.ellipse(ox + obs.width / 2, carY + carH + 3, obs.width * 0.45, 5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Car body gradient
            const carGrad = ctx.createLinearGradient(ox, carY, ox, carY + carH);
            carGrad.addColorStop(0, carMain);
            carGrad.addColorStop(0.6, carDark);
            carGrad.addColorStop(1, carMain);
            ctx.fillStyle = carGrad;
            ctx.beginPath();
            ctx.roundRect(ox + 3, carY + 2, obs.width - 6, carH - 2, 8);
            ctx.fill();

            // Roof / cabin area (darker)
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            const cabinStart = goingRight ? ox + obs.width * 0.3 : ox + obs.width * 0.15;
            ctx.beginPath();
            ctx.roundRect(cabinStart, carY + 3, obs.width * 0.55, carH * 0.5, 5);
            ctx.fill();

            // Windshield with reflection
            ctx.fillStyle = 'rgba(150, 220, 255, 0.5)';
            const windX = goingRight ? ox + obs.width * 0.65 : ox + obs.width * 0.1;
            ctx.beginPath();
            ctx.roundRect(windX, carY + 4, obs.width * 0.22, carH * 0.45, 3);
            ctx.fill();

            // Headlights (glowing)
            const hlX = goingRight ? ox + obs.width - 6 : ox + 6;
            ctx.shadowColor = '#ffffaa';
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#ffffcc';
            ctx.beginPath();
            ctx.arc(hlX, carY + carH * 0.3, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(hlX, carY + carH * 0.7, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Tail lights (red glow)
            const tlX = goingRight ? ox + 5 : ox + obs.width - 5;
            ctx.shadowColor = '#ff3333';
            ctx.shadowBlur = 6;
            ctx.fillStyle = '#ff4444';
            ctx.beginPath();
            ctx.arc(tlX, carY + carH * 0.3, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(tlX, carY + carH * 0.7, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Wheels with rim detail
            const wheelY1 = carY + carH - 1;
            const wheelR = 4;
            ctx.fillStyle = '#111';
            ctx.beginPath();
            ctx.arc(ox + obs.width * 0.2, wheelY1, wheelR, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(ox + obs.width * 0.8, wheelY1, wheelR, 0, Math.PI * 2);
            ctx.fill();
            // Rim shine
            ctx.fillStyle = '#444';
            ctx.beginPath();
            ctx.arc(ox + obs.width * 0.2, wheelY1, wheelR * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(ox + obs.width * 0.8, wheelY1, wheelR * 0.5, 0, Math.PI * 2);
            ctx.fill();

          } else if (lane.type === 'water') {
            // Textured wooden log
            const logH = g.cellSize * 0.65;
            const logY = oy + (g.cellSize - logH) / 2;

            // Log shadow in water
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.roundRect(ox + 3, logY + 5, obs.width, logH, 10);
            ctx.fill();

            // Main log gradient
            const logGrad = ctx.createLinearGradient(ox, logY, ox, logY + logH);
            logGrad.addColorStop(0, '#a0724a');
            logGrad.addColorStop(0.3, '#8B5E3C');
            logGrad.addColorStop(0.7, '#6d4530');
            logGrad.addColorStop(1, '#8B5E3C');
            ctx.fillStyle = logGrad;
            ctx.beginPath();
            ctx.roundRect(ox, logY, obs.width, logH, 10);
            ctx.fill();

            // Bark texture lines
            ctx.strokeStyle = 'rgba(90, 60, 30, 0.4)';
            ctx.lineWidth = 1;
            for (let lx = ox + 15; lx < ox + obs.width - 10; lx += 12) {
              ctx.beginPath();
              ctx.moveTo(lx, logY + 3);
              ctx.lineTo(lx + 2, logY + logH - 3);
              ctx.stroke();
            }

            // Horizontal grain lines
            ctx.strokeStyle = 'rgba(60, 40, 20, 0.3)';
            ctx.beginPath();
            ctx.moveTo(ox + 12, logY + logH * 0.33);
            ctx.lineTo(ox + obs.width - 12, logY + logH * 0.33);
            ctx.moveTo(ox + 12, logY + logH * 0.66);
            ctx.lineTo(ox + obs.width - 12, logY + logH * 0.66);
            ctx.stroke();

            // Log end circles (cross-section)
            const endGrad = ctx.createRadialGradient(ox + 6, logY + logH / 2, 0, ox + 6, logY + logH / 2, logH * 0.35);
            endGrad.addColorStop(0, '#c4956a');
            endGrad.addColorStop(0.5, '#a07a55');
            endGrad.addColorStop(1, '#7a5a3a');
            ctx.fillStyle = endGrad;
            ctx.beginPath();
            ctx.ellipse(ox + 6, logY + logH / 2, 6, logH * 0.35, 0, 0, Math.PI * 2);
            ctx.fill();
            // Ring detail
            ctx.strokeStyle = 'rgba(90, 60, 30, 0.4)';
            ctx.beginPath();
            ctx.ellipse(ox + 6, logY + logH / 2, 3, logH * 0.2, 0, 0, Math.PI * 2);
            ctx.stroke();

            const endGrad2 = ctx.createRadialGradient(ox + obs.width - 6, logY + logH / 2, 0, ox + obs.width - 6, logY + logH / 2, logH * 0.35);
            endGrad2.addColorStop(0, '#c4956a');
            endGrad2.addColorStop(0.5, '#a07a55');
            endGrad2.addColorStop(1, '#7a5a3a');
            ctx.fillStyle = endGrad2;
            ctx.beginPath();
            ctx.ellipse(ox + obs.width - 6, logY + logH / 2, 6, logH * 0.35, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(90, 60, 30, 0.4)';
            ctx.beginPath();
            ctx.ellipse(ox + obs.width - 6, logY + logH / 2, 3, logH * 0.2, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const p of g.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Draw player (chicken)
      let px: number, py: number;
      let squashX = 1, squashY = 1;
      if (g.isHopping) {
        const t = g.animProgress;
        const startPx = g.playerX * g.cellSize + g.cellSize / 2;
        const endPx = g.targetX * g.cellSize + g.cellSize / 2;
        px = startPx + (endPx - startPx) * t;
        const startRow = g.playerY;
        const endRow = g.targetY;
        const worldRow = startRow + (endRow - startRow) * t;
        const { screenY } = worldToScreen(0, worldRow, g, H);
        py = screenY + g.cellSize / 2;
        // Hop arc
        py -= Math.sin(t * Math.PI) * g.cellSize * 0.5;
        // Squash and stretch
        const hopPhase = Math.sin(t * Math.PI);
        squashX = 1 - hopPhase * 0.15;
        squashY = 1 + hopPhase * 0.2;
      } else {
        px = g.playerPixelX;
        const { screenY } = worldToScreen(0, g.playerY, g, H);
        py = screenY + g.cellSize / 2;
      }

      const pSize = g.cellSize * 0.4;

      if (!g.gameOver) {
        ctx.save();
        ctx.translate(px, py);
        ctx.scale(squashX, squashY);

        // Chicken glow
        ctx.shadowColor = '#ffee55';
        ctx.shadowBlur = 12;

        // Body gradient (cute rounded chicken)
        const bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, pSize);
        bodyGrad.addColorStop(0, '#fff176');
        bodyGrad.addColorStop(0.6, '#ffeb3b');
        bodyGrad.addColorStop(1, '#f9a825');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(0, 0, pSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Body outline
        ctx.strokeStyle = '#f57f17';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Small wings
        ctx.fillStyle = 'rgba(255, 200, 50, 0.7)';
        // Left wing
        ctx.beginPath();
        ctx.ellipse(-pSize * 0.8, pSize * 0.1, pSize * 0.3, pSize * 0.5, -0.3, 0, Math.PI * 2);
        ctx.fill();
        // Right wing
        ctx.beginPath();
        ctx.ellipse(pSize * 0.8, pSize * 0.1, pSize * 0.3, pSize * 0.5, 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Eyes - white sclera
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(-pSize * 0.28, -pSize * 0.2, pSize * 0.22, pSize * 0.26, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(pSize * 0.28, -pSize * 0.2, pSize * 0.22, pSize * 0.26, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eye outlines
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(-pSize * 0.28, -pSize * 0.2, pSize * 0.22, pSize * 0.26, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(pSize * 0.28, -pSize * 0.2, pSize * 0.22, pSize * 0.26, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Pupils
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(-pSize * 0.22, -pSize * 0.18, pSize * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pSize * 0.32, -pSize * 0.18, pSize * 0.1, 0, Math.PI * 2);
        ctx.fill();

        // Eye shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-pSize * 0.26, -pSize * 0.25, pSize * 0.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(pSize * 0.28, -pSize * 0.25, pSize * 0.05, 0, Math.PI * 2);
        ctx.fill();

        // Beak - gradient orange
        const beakGrad = ctx.createLinearGradient(0, pSize * 0.1, 0, pSize * 0.45);
        beakGrad.addColorStop(0, '#ff9800');
        beakGrad.addColorStop(1, '#e65100');
        ctx.fillStyle = beakGrad;
        ctx.beginPath();
        ctx.moveTo(0, pSize * 0.05);
        ctx.lineTo(-pSize * 0.22, pSize * 0.35);
        ctx.lineTo(pSize * 0.22, pSize * 0.35);
        ctx.closePath();
        ctx.fill();

        // Cheek blush
        ctx.fillStyle = 'rgba(255, 120, 100, 0.25)';
        ctx.beginPath();
        ctx.ellipse(-pSize * 0.45, pSize * 0.05, pSize * 0.15, pSize * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(pSize * 0.45, pSize * 0.05, pSize * 0.15, pSize * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      } else {
        // Death effect
        if (g.deathType === 'water') {
          // Ripple circles expanding
          const deathProgress = Math.min(1, (g.particles.length > 0 ? 1 - g.particles[0].life / g.particles[0].maxLife : 1));
          for (let r = 0; r < 3; r++) {
            const radius = (deathProgress * 30 + r * 15) * (1 + r * 0.3);
            ctx.strokeStyle = `rgba(100, 220, 255, ${0.3 - deathProgress * 0.3})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(px, py, radius, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else {
          // Hit by car - flash
          ctx.fillStyle = 'rgba(255, 50, 50, 0.5)';
          ctx.beginPath();
          ctx.arc(px, py, pSize * 1.5, 0, Math.PI * 2);
          ctx.fill();
          // X mark
          ctx.strokeStyle = '#ff4444';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#ff0000';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(px - pSize * 0.5, py - pSize * 0.5);
          ctx.lineTo(px + pSize * 0.5, py + pSize * 0.5);
          ctx.moveTo(px + pSize * 0.5, py - pSize * 0.5);
          ctx.lineTo(px - pSize * 0.5, py + pSize * 0.5);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      // HUD - Score with neon style
      ctx.fillStyle = 'rgba(10, 10, 30, 0.7)';
      ctx.beginPath();
      ctx.roundRect(W / 2 - 50, 6, 100, 34, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(100, 200, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(W / 2 - 50, 6, 100, 34, 10);
      ctx.stroke();
      ctx.shadowColor = '#00ccff';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${g.score}`, W / 2, 23);
      ctx.shadowBlur = 0;

      // Game over overlay
      if (g.gameOver) {
        // Dark vignette
        const vignetteGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
        vignetteGrad.addColorStop(0, 'rgba(0,0,0,0.3)');
        vignetteGrad.addColorStop(1, 'rgba(0,0,0,0.8)');
        ctx.fillStyle = vignetteGrad;
        ctx.fillRect(0, 0, W, H);

        // Game over text with glow
        ctx.shadowColor = '#ff3366';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', W / 2, H / 2 - 10);
        ctx.shadowColor = '#00ccff';
        ctx.shadowBlur = 10;
        ctx.font = '18px monospace';
        ctx.fillText(`Score: ${g.score}`, W / 2, H / 2 + 20);
        ctx.shadowBlur = 0;
      }

      animFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animFrameRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [canvasSize, getLane, worldToScreen, onGameOver, tryHop]);

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="rounded-lg border-2 border-cyan-900/50 touch-none"
        style={{ maxWidth: '100%', background: '#0a0a1a' }}
      />
      <p className="text-xs text-gray-400 text-center">
        Arrow keys / WASD / Swipe to hop. Tap to hop forward.
      </p>
    </div>
  );
}
