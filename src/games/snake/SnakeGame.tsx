'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { playPickup, playDeath, playGameOver } from '@/lib/sounds';

interface SnakeGameProps {
  onGameOver: (score: number) => void;
  level: 'easy' | 'medium' | 'hard';
}

const LEVEL_CONFIG = {
  easy:   { gridSize: 12, initialSpeed: 200, minSpeed: 100 },
  medium: { gridSize: 16, initialSpeed: 120, minSpeed: 60 },
  hard:   { gridSize: 20, initialSpeed: 70,  minSpeed: 35 },
} as const;

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Point = { x: number; y: number };

export default function SnakeGame({ onGameOver, level }: SnakeGameProps) {
  const { gridSize: GRID_SIZE, initialSpeed: INITIAL_SPEED, minSpeed: MIN_SPEED } = LEVEL_CONFIG[level];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<{
    snake: Point[];
    food: Point;
    direction: Direction;
    nextDirection: Direction;
    score: number;
    gameOver: boolean;
    gameOverNotified: boolean;
    cellSize: number;
    cols: number;
    rows: number;
    speed: number;
    lastMoveTime: number;
  } | null>(null);
  const animFrameRef = useRef<number>(0);
  const touchStartRef = useRef<Point | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 400 });

  const getCanvasSize = useCallback(() => {
    const maxW = Math.min(window.innerWidth - 32, 600);
    const maxH = Math.min(window.innerHeight - 120, 600);
    const size = Math.min(maxW, maxH);
    const cellSize = Math.floor(size / GRID_SIZE);
    const canvasW = cellSize * GRID_SIZE;
    const canvasH = cellSize * GRID_SIZE;
    return { width: canvasW, height: canvasH, cellSize };
  }, []);

  const spawnFood = useCallback((snake: Point[], cols: number, rows: number): Point => {
    let food: Point;
    do {
      food = {
        x: Math.floor(Math.random() * cols),
        y: Math.floor(Math.random() * rows),
      };
    } while (snake.some(s => s.x === food.x && s.y === food.y));
    return food;
  }, []);

  const initGame = useCallback(() => {
    const { width, height, cellSize } = getCanvasSize();
    setCanvasSize({ width, height });
    const cols = GRID_SIZE;
    const rows = GRID_SIZE;
    const centerX = Math.floor(cols / 2);
    const centerY = Math.floor(rows / 2);
    const snake: Point[] = [
      { x: centerX, y: centerY },
      { x: centerX - 1, y: centerY },
      { x: centerX - 2, y: centerY },
    ];
    gameStateRef.current = {
      snake,
      food: spawnFood(snake, cols, rows),
      direction: 'RIGHT',
      nextDirection: 'RIGHT',
      score: 0,
      gameOver: false,
      gameOverNotified: false,
      cellSize,
      cols,
      rows,
      speed: INITIAL_SPEED,
      lastMoveTime: 0,
    };
  }, [getCanvasSize, spawnFood]);

  const trailRef = useRef<Array<{ x: number; y: number; alpha: number }>>([]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const state = gameStateRef.current;
    if (!canvas || !state) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { snake, food, cellSize, cols, rows, score, gameOver } = state;
    const time = Date.now() * 0.001;

    // Background with radial gradient
    const bgGrad = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, 0,
      canvas.width / 2, canvas.height / 2, canvas.width * 0.8
    );
    bgGrad.addColorStop(0, '#161630');
    bgGrad.addColorStop(1, '#0a0a18');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle grid lines with glow
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.03)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, rows * cellSize);
      ctx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(cols * cellSize, y * cellSize);
      ctx.stroke();
    }

    // Update trail - add current head position
    if (snake.length > 0 && !gameOver) {
      const head = snake[0];
      trailRef.current.push({ x: head.x, y: head.y, alpha: 0.6 });
      // Fade and clean trail
      trailRef.current = trailRef.current
        .map(t => ({ ...t, alpha: t.alpha - 0.04 }))
        .filter(t => t.alpha > 0);
    }

    // Draw trail / afterglow
    trailRef.current.forEach(t => {
      const tx = t.x * cellSize + cellSize / 2;
      const ty = t.y * cellSize + cellSize / 2;
      const trailGrad = ctx.createRadialGradient(tx, ty, 0, tx, ty, cellSize * 0.6);
      trailGrad.addColorStop(0, `rgba(0, 255, 136, ${t.alpha * 0.3})`);
      trailGrad.addColorStop(1, 'rgba(0, 255, 136, 0)');
      ctx.fillStyle = trailGrad;
      ctx.fillRect(tx - cellSize, ty - cellSize, cellSize * 2, cellSize * 2);
    });

    // Food - pulsing glowing orb with halo
    const foodCenterX = food.x * cellSize + cellSize / 2;
    const foodCenterY = food.y * cellSize + cellSize / 2;
    const pulse = 0.85 + Math.sin(time * 5) * 0.15;
    const foodRadius = cellSize * 0.35 * pulse;

    // Outer halo
    const haloGrad = ctx.createRadialGradient(
      foodCenterX, foodCenterY, foodRadius * 0.5,
      foodCenterX, foodCenterY, cellSize * 1.2
    );
    haloGrad.addColorStop(0, 'rgba(255, 0, 68, 0.25)');
    haloGrad.addColorStop(0.5, 'rgba(255, 0, 68, 0.08)');
    haloGrad.addColorStop(1, 'rgba(255, 0, 68, 0)');
    ctx.fillStyle = haloGrad;
    ctx.fillRect(foodCenterX - cellSize * 1.5, foodCenterY - cellSize * 1.5, cellSize * 3, cellSize * 3);

    // Inner orb with gradient
    const foodGrad = ctx.createRadialGradient(
      foodCenterX - foodRadius * 0.3, foodCenterY - foodRadius * 0.3, 0,
      foodCenterX, foodCenterY, foodRadius
    );
    foodGrad.addColorStop(0, '#ff6688');
    foodGrad.addColorStop(0.6, '#ff0044');
    foodGrad.addColorStop(1, '#cc0033');
    ctx.shadowColor = '#ff0044';
    ctx.shadowBlur = 18 * pulse;
    ctx.fillStyle = foodGrad;
    ctx.beginPath();
    ctx.arc(foodCenterX, foodCenterY, foodRadius, 0, Math.PI * 2);
    ctx.fill();

    // Specular highlight on food
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(foodCenterX - foodRadius * 0.25, foodCenterY - foodRadius * 0.25, foodRadius * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Snake body
    snake.forEach((segment, i) => {
      const x = segment.x * cellSize;
      const y = segment.y * cellSize;
      const padding = 1;
      const segW = cellSize - padding * 2;
      const segH = cellSize - padding * 2;
      const t = i / Math.max(1, snake.length - 1);

      if (i === 0) {
        // Head with gradient fill
        const headGrad = ctx.createLinearGradient(x, y, x + cellSize, y + cellSize);
        headGrad.addColorStop(0, '#00ffaa');
        headGrad.addColorStop(1, '#00cc77');
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 16;
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.roundRect(x + padding, y + padding, segW, segH, 6);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Glowing eyes
        const eyeSize = cellSize * 0.14;
        const glowSize = cellSize * 0.22;
        let eye1x: number, eye1y: number, eye2x: number, eye2y: number;

        if (state.direction === 'RIGHT' || state.direction === 'LEFT') {
          const eyeX = state.direction === 'RIGHT' ? x + cellSize * 0.72 : x + cellSize * 0.28;
          eye1x = eyeX; eye1y = y + cellSize * 0.3;
          eye2x = eyeX; eye2y = y + cellSize * 0.7;
        } else {
          const eyeY = state.direction === 'DOWN' ? y + cellSize * 0.72 : y + cellSize * 0.28;
          eye1x = x + cellSize * 0.3; eye1y = eyeY;
          eye2x = x + cellSize * 0.7; eye2y = eyeY;
        }

        // Eye glow
        [{ ex: eye1x, ey: eye1y }, { ex: eye2x, ey: eye2y }].forEach(({ ex, ey }) => {
          const eyeGlow = ctx.createRadialGradient(ex, ey, 0, ex, ey, glowSize);
          eyeGlow.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
          eyeGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = eyeGlow;
          ctx.fillRect(ex - glowSize, ey - glowSize, glowSize * 2, glowSize * 2);

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(ex, ey, eyeSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0a0a18';
          ctx.beginPath();
          ctx.arc(ex, ey, eyeSize * 0.5, 0, Math.PI * 2);
          ctx.fill();
        });
      } else {
        // Body segments with gradient that fades toward tail
        const brightness = 1 - t * 0.65;
        const r = Math.floor(0);
        const g = Math.floor(220 * brightness);
        const b = Math.floor(120 * brightness);
        const segGrad = ctx.createLinearGradient(x, y, x + cellSize, y + cellSize);
        segGrad.addColorStop(0, `rgba(${r}, ${g + 30}, ${b + 20}, 1)`);
        segGrad.addColorStop(1, `rgba(${r}, ${g - 20}, ${b - 10}, 1)`);

        // Subtle glow for first few body segments
        if (i < 4) {
          ctx.shadowColor = `rgba(0, ${g}, ${b}, 0.5)`;
          ctx.shadowBlur = 6 - i;
        }

        ctx.fillStyle = segGrad;
        ctx.beginPath();
        ctx.roundRect(x + padding, y + padding, segW, segH, 5 - Math.min(t * 3, 2));
        ctx.fill();
        ctx.shadowBlur = 0;

        // Subtle inner highlight
        ctx.fillStyle = `rgba(255, 255, 255, ${0.08 * (1 - t)})`;
        ctx.beginPath();
        ctx.roundRect(x + padding + 1, y + padding + 1, segW - 2, segH * 0.4, 3);
        ctx.fill();
      }
    });

    // Score display with glow
    ctx.save();
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#00ff88';
    ctx.font = `bold ${Math.max(14, cellSize * 0.8)}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE`, 10, cellSize * 0.75);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(16, cellSize * 0.9)}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(`${score}`, 10 + ctx.measureText('SCORE ').width, cellSize * 0.75);
    ctx.restore();

    // Game over overlay
    if (gameOver) {
      // Dark overlay with slight vignette
      const overlayGrad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width * 0.7
      );
      overlayGrad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
      overlayGrad.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
      ctx.fillStyle = overlayGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // GAME OVER text with glow
      ctx.shadowColor = '#ff0044';
      ctx.shadowBlur = 25;
      ctx.fillStyle = '#ff0044';
      ctx.font = `bold ${cellSize * 1.5}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - cellSize);
      ctx.shadowBlur = 0;

      // Score with glow
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#00ff88';
      ctx.font = `bold ${cellSize * 1.1}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillText(`${score}`, canvas.width / 2, canvas.height / 2 + cellSize * 0.6);
      ctx.shadowBlur = 0;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = `${cellSize * 0.55}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillText('Tap or press any key to restart', canvas.width / 2, canvas.height / 2 + cellSize * 2);
    }
  }, []);

  const gameLoop = useCallback((timestamp: number) => {
    const state = gameStateRef.current;
    if (!state || state.gameOver) {
      draw();
      return;
    }

    if (timestamp - state.lastMoveTime >= state.speed) {
      state.lastMoveTime = timestamp;
      state.direction = state.nextDirection;

      const head = { ...state.snake[0] };
      switch (state.direction) {
        case 'UP': head.y--; break;
        case 'DOWN': head.y++; break;
        case 'LEFT': head.x--; break;
        case 'RIGHT': head.x++; break;
      }

      // Wall collision
      if (head.x < 0 || head.x >= state.cols || head.y < 0 || head.y >= state.rows) {
        state.gameOver = true;
        playDeath();
        playGameOver();
        draw();
        if (!state.gameOverNotified) {
          state.gameOverNotified = true;
          setTimeout(() => onGameOver(state.score), 2500);
        }
        return;
      }

      // Self collision
      if (state.snake.some(s => s.x === head.x && s.y === head.y)) {
        state.gameOver = true;
        playDeath();
        playGameOver();
        draw();
        if (!state.gameOverNotified) {
          state.gameOverNotified = true;
          setTimeout(() => onGameOver(state.score), 2500);
        }
        return;
      }

      state.snake.unshift(head);

      // Eat food
      if (head.x === state.food.x && head.y === state.food.y) {
        state.score += 10;
        state.food = spawnFood(state.snake, state.cols, state.rows);
        state.speed = Math.max(MIN_SPEED, state.speed - 2);
        playPickup();
      } else {
        state.snake.pop();
      }
    }

    draw();
    animFrameRef.current = requestAnimationFrame(gameLoop);
  }, [draw, onGameOver, spawnFood]);

  const handleDirection = useCallback((dir: Direction) => {
    const state = gameStateRef.current;
    if (!state || state.gameOver) return;
    const opposites: Record<Direction, Direction> = {
      UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
    };
    if (opposites[dir] !== state.direction) {
      state.nextDirection = dir;
    }
  }, []);

  const restart = useCallback(() => {
    initGame();
    animFrameRef.current = requestAnimationFrame(gameLoop);
  }, [initGame, gameLoop]);

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const state = gameStateRef.current;
      if (state?.gameOver) {
        restart();
        return;
      }
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': e.preventDefault(); handleDirection('UP'); break;
        case 'ArrowDown': case 's': case 'S': e.preventDefault(); handleDirection('DOWN'); break;
        case 'ArrowLeft': case 'a': case 'A': e.preventDefault(); handleDirection('LEFT'); break;
        case 'ArrowRight': case 'd': case 'D': e.preventDefault(); handleDirection('RIGHT'); break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleDirection, restart]);

  // Touch
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const state = gameStateRef.current;
      if (state?.gameOver) {
        restart();
        return;
      }
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const minSwipe = 20;

      if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) return;

      if (Math.abs(dx) > Math.abs(dy)) {
        handleDirection(dx > 0 ? 'RIGHT' : 'LEFT');
      } else {
        handleDirection(dy > 0 ? 'DOWN' : 'UP');
      }
      touchStartRef.current = null;
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleDirection, restart]);

  // Init and game loop
  useEffect(() => {
    initGame();
    animFrameRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [initGame, gameLoop]);

  // Resize
  useEffect(() => {
    const handleResize = () => {
      const { width, height, cellSize } = getCanvasSize();
      setCanvasSize({ width, height });
      if (gameStateRef.current) {
        gameStateRef.current.cellSize = cellSize;
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getCanvasSize]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        style={{
          display: 'block',
          borderRadius: '8px',
          border: '2px solid #00ff8844',
          touchAction: 'none',
          maxWidth: '100%',
        }}
      />
    </div>
  );
}
