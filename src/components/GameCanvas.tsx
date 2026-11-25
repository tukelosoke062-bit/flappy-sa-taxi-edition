import React, { useEffect, useRef, useCallback } from 'react';
import { GameState, Particle, PipePair } from '../types/game';
import { sound } from '../utils/sound';

export const CANVAS_WIDTH = 380;
export const CANVAS_HEIGHT = 640;
const GROUND_HEIGHT = 84;
const PLAYABLE_BOTTOM = CANVAS_HEIGHT - GROUND_HEIGHT;
const BIRD_X = 94;
const BIRD_RADIUS = 15;
const PIPE_WIDTH = 66;

interface GameCanvasProps {
  gameState: GameState;
  resetToken: number;
  resumeToken: number;
  score: number;
  onScoreChange: (newScore: number) => void;
  onGameOver: (finalScore: number) => void;
  onRequestStart?: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  resetToken,
  resumeToken,
  score,
  onScoreChange,
  onGameOver,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mutable simulation refs so RAF loop runs at native refresh rate without React re-render overhead
  const stateRef = useRef<GameState>(gameState);
  const birdYRef = useRef<number>(280);
  const velRef = useRef<number>(0);
  const pipesRef = useRef<PipePair[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const scoreRef = useRef<number>(score);
  const scrollXRef = useRef<number>(0);
  const skylineXRef = useRef<number>(0);
  const cloudXRef = useRef<number>(0);
  const distSincePipeRef = useRef<number>(135);
  const graceUntilRef = useRef<number>(0);
  const wingPhaseRef = useRef<number>(0);

  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  // Reset full run
  useEffect(() => {
    birdYRef.current = 280;
    velRef.current = 0;
    pipesRef.current = [];
    particlesRef.current = [];
    distSincePipeRef.current = 140;
    graceUntilRef.current = 0;
  }, [resetToken]);

  // Resume from Ad Break
  useEffect(() => {
    if (resumeToken === 0) return;
    pipesRef.current = [];
    particlesRef.current = [];
    birdYRef.current = 260;
    velRef.current = -4.5;
    distSincePipeRef.current = 120;
    graceUntilRef.current = performance.now() + 1400;
  }, [resumeToken]);

  const spawnFlapParticles = useCallback((x: number, y: number) => {
    const colors = ['#FEF08A', '#FDE047', '#FFFFFF', '#22C55E'];
    for (let i = 0; i < 5; i++) {
      particlesRef.current.push({
        x: x - 12 + (Math.random() - 0.5) * 8,
        y: y + 4 + (Math.random() - 0.5) * 8,
        vx: -1.5 - Math.random() * 2,
        vy: 1 + Math.random() * 2.5,
        life: 1,
        maxLife: 1,
        size: 2.5 + Math.random() * 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }, []);

  const spawnMilestoneParticles = useCallback((x: number, y: number) => {
    // SA Flag palette burst
    const colors = ['#FACC15', '#16A34A', '#DC2626', '#2563EB', '#FFFFFF'];
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16 + Math.random() * 0.2;
      const speed = 2 + Math.random() * 3.5;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: 1,
        maxLife: 1,
        size: 3 + Math.random() * 3,
        color: colors[i % colors.length],
      });
    }
  }, []);

  const triggerFlap = useCallback(() => {
    if (stateRef.current !== 'PLAYING') return;
    velRef.current = -8.6;
    wingPhaseRef.current = Math.PI;
    spawnFlapParticles(BIRD_X, birdYRef.current);
    sound.playFlap();
  }, [spawnFlapParticles]);

  // Keyboard flap listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        if (stateRef.current === 'PLAYING') {
          e.preventDefault();
          triggerFlap();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerFlap]);

  // Main render & physics RAF loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;

    let rafId = 0;
    let lastTime = performance.now();

    const drawSkyAndSun = () => {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, PLAYABLE_BOTTOM);
      skyGrad.addColorStop(0, '#38BDF8');
      skyGrad.addColorStop(0.62, '#BAE6FD');
      skyGrad.addColorStop(1, '#FEF08A');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, PLAYABLE_BOTTOM);

      // Warm Highveld sun
      ctx.save();
      ctx.fillStyle = 'rgba(253, 224, 71, 0.35)';
      ctx.beginPath();
      ctx.arc(305, 92, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(305, 92, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawClouds = (offset: number) => {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      const clouds = [
        { x: 40, y: 86, s: 1 },
        { x: 185, y: 132, s: 0.82 },
        { x: 315, y: 68, s: 0.92 },
      ];
      clouds.forEach((c) => {
        const cx = ((c.x - offset) % (CANVAS_WIDTH + 120) + (CANVAS_WIDTH + 120)) % (CANVAS_WIDTH + 120) - 60;
        const cy = c.y;
        const s = c.s;
        ctx.beginPath();
        ctx.arc(cx, cy, 16 * s, 0, Math.PI * 2);
        ctx.arc(cx + 16 * s, cy - 6 * s, 20 * s, 0, Math.PI * 2);
        ctx.arc(cx + 34 * s, cy, 15 * s, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    };

    const drawJoburgSkyline = (offset: number) => {
      const tileWidth = 380;
      const baseY = PLAYABLE_BOTTOM;
      const startOffset = -((offset % tileWidth + tileWidth) % tileWidth);

      for (let tile = 0; tile < 2; tile++) {
        const ox = startOffset + tile * tileWidth;

        // Distant skyline layer
        ctx.fillStyle = '#94A3B8';
        ctx.fillRect(ox + 15, baseY - 95, 34, 95);
        ctx.fillRect(ox + 68, baseY - 130, 38, 130);
        // Ponte City cylindrical tower silhouette
        ctx.fillRect(ox + 132, baseY - 155, 42, 155);
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(ox + 137, baseY - 142, 32, 6);
        ctx.fillRect(ox + 137, baseY - 128, 32, 6);

        // Hillbrow Tower (iconic spire + top sphere)
        ctx.fillStyle = '#64748B';
        ctx.fillRect(ox + 212, baseY - 165, 10, 165);
        ctx.fillRect(ox + 215, baseY - 210, 4, 48);
        ctx.beginPath();
        ctx.arc(ox + 217, baseY - 152, 11, 0, Math.PI * 2);
        ctx.fill();

        // Carlton Centre & office blocks
        ctx.fillStyle = '#78716C';
        ctx.fillRect(ox + 256, baseY - 148, 44, 148);
        ctx.fillRect(ox + 318, baseY - 108, 46, 108);

        // Foreground mid-rise buildings
        ctx.fillStyle = '#475569';
        ctx.fillRect(ox + 4, baseY - 64, 28, 64);
        ctx.fillRect(ox + 44, baseY - 78, 30, 78);
        ctx.fillRect(ox + 100, baseY - 56, 36, 56);
        ctx.fillRect(ox + 180, baseY - 74, 28, 74);
        ctx.fillRect(ox + 235, baseY - 60, 26, 60);
        ctx.fillRect(ox + 296, baseY - 82, 32, 82);
        ctx.fillRect(ox + 348, baseY - 58, 32, 58);

        // Subtle warm lit windows
        ctx.fillStyle = 'rgba(254, 240, 138, 0.5)';
        for (let wy = baseY - 52; wy < baseY - 14; wy += 14) {
          ctx.fillRect(ox + 10, wy, 5, 6);
          ctx.fillRect(ox + 20, wy, 5, 6);
          ctx.fillRect(ox + 50, wy - 12, 6, 6);
          ctx.fillRect(ox + 62, wy - 12, 6, 6);
          ctx.fillRect(ox + 303, wy - 16, 6, 6);
          ctx.fillRect(ox + 315, wy - 16, 6, 6);
        }
      }
    };

    const drawTaxiBarrier = (x: number, y: number, height: number, isTop: boolean) => {
      if (height <= 0) return;

      ctx.save();
      // Main taxi gold pillar body
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(x, y, PIPE_WIDTH, height);

      // Subtle vertical highlight & shading
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(x + 4, y, 8, height);
      ctx.fillStyle = 'rgba(180, 83, 9, 0.22)';
      ctx.fillRect(x + PIPE_WIDTH - 12, y, 10, height);

      // Black hazard stripes along the column
      ctx.beginPath();
      ctx.rect(x, y, PIPE_WIDTH, height);
      ctx.clip();

      ctx.fillStyle = '#0F172A';
      const stripeSpacing = 26;
      for (let sy = y - 30; sy < y + height + 30; sy += stripeSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, sy);
        ctx.lineTo(x + PIPE_WIDTH, sy + 12);
        ctx.lineTo(x + PIPE_WIDTH, sy + 20);
        ctx.lineTo(x, sy + 8);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Pillar outer border
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, PIPE_WIDTH, height);

      // Minibus Taxi Cab Cap facing the gap
      const capHeight = Math.min(34, height);
      const capY = isTop ? y + height - capHeight : y;
      const capX = x - 4;
      const capW = PIPE_WIDTH + 8;

      // Taxi roof/bumper block
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(capX, capY, capW, capHeight, 6);
      ctx.fill();
      ctx.stroke();

      if (capHeight >= 26) {
        // Blue/dark windshield band
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(capX + 8, capY + 6, capW - 16, 10);

        // Headlights + SA taxi yellow strip
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(capX + 4, capY + capHeight - 12, capW - 8, 6);

        ctx.fillStyle = '#FEF08A';
        ctx.fillRect(capX + 8, capY + capHeight - 11, 10, 4);
        ctx.fillRect(capX + capW - 18, capY + capHeight - 11, 10, 4);

        // Tiny "TAXI" roof sign
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 8px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TAXI', capX + capW / 2, capY + 14);
      }
    };

    const drawGround = (offset: number) => {
      // Road kerb top strip (SA taxi rank yellow & black kerb)
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(0, PLAYABLE_BOTTOM, CANVAS_WIDTH, 10);

      const kerbW = 28;
      const kerbStart = -((offset % (kerbW * 2) + kerbW * 2) % (kerbW * 2));
      ctx.fillStyle = '#0F172A';
      for (let kx = kerbStart; kx < CANVAS_WIDTH + kerbW; kx += kerbW * 2) {
        ctx.fillRect(kx, PLAYABLE_BOTTOM, kerbW, 10);
      }

      // Asphalt body
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, PLAYABLE_BOTTOM + 10, CANVAS_WIDTH, GROUND_HEIGHT - 10);

      // Dashed white/amber lane lines
      const dashW = 34;
      const dashGap = 28;
      const period = dashW + dashGap;
      const dashStart = -((offset % period + period) % period);
      ctx.fillStyle = '#FDE047';
      for (let dx = dashStart; dx < CANVAS_WIDTH + period; dx += period) {
        ctx.fillRect(dx, PLAYABLE_BOTTOM + 38, dashW, 5);
      }

      // Clean road label
      ctx.fillStyle = 'rgba(248, 250, 252, 0.55)';
      ctx.font = '700 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('JOBURG · M1 EXPRESSWAY', CANVAS_WIDTH / 2, PLAYABLE_BOTTOM + 68);
    };

    const drawBird = (x: number, y: number, vel: number, now: number) => {
      const isGrace = now < graceUntilRef.current;
      if (isGrace && Math.floor(now / 90) % 2 === 0) {
        ctx.save();
        ctx.globalAlpha = 0.55;
      } else {
        ctx.save();
      }

      const angle = Math.max(-0.45, Math.min(1.1, vel * 0.065));
      ctx.translate(x, y);
      ctx.rotate(angle);

      // Mini SA Flag fluttering tail pennant
      const flagWave = Math.sin(now * 0.018) * 2;
      ctx.save();
      ctx.translate(-22, -4 + flagWave * 0.4);
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      // Red top stripe
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(-10, -6, 16, 4);
      // Blue bottom stripe
      ctx.fillStyle = '#1D4ED8';
      ctx.fillRect(-10, 2, 16, 4);
      // White band + Green Y
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-10, -2, 16, 4);
      ctx.fillStyle = '#16A34A';
      ctx.beginPath();
      ctx.moveTo(-10, -6);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-10, 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeRect(-10, -6, 16, 12);
      ctx.restore();

      // Main bird body
      ctx.fillStyle = '#FACC15';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, 20, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Warm belly shading
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.ellipse(2, 5, 13, 8, 0, 0, Math.PI);
      ctx.fill();

      // Flapping wing
      const wingOffset = Math.sin(wingPhaseRef.current) * 5;
      ctx.fillStyle = '#F59E0B';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(-4, 2 + wingOffset * 0.5, 9, 6, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Crisp eye
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(8, -5, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(10, -5, 2.6, 0, Math.PI * 2);
      ctx.fill();

      // Orange beak
      ctx.fillStyle = '#F97316';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(15, -1);
      ctx.lineTo(27, 3);
      ctx.lineTo(15, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    };

    const drawParticles = () => {
      particlesRef.current.forEach((p) => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    };

    const tick = (now: number) => {
      const rawDt = now - lastTime;
      lastTime = now;
      // Normalize to 50Hz prototype step so physics match classic feel across 60Hz/120Hz screens
      const step = Math.min(rawDt / 20, 2.2);
      const currentState = stateRef.current;

      if (currentState === 'READY') {
        cloudXRef.current += 0.25 * step;
        skylineXRef.current += 0.45 * step;
        scrollXRef.current += 1.6 * step;
        birdYRef.current = 278 + Math.sin(now * 0.0045) * 9;
        wingPhaseRef.current += 0.16 * step;
      } else if (currentState === 'PLAYING') {
        const speedMultiplier = 1 + Math.min(scoreRef.current * 0.014, 0.38);
        const scrollSpeed = 3.05 * speedMultiplier * step;

        cloudXRef.current += 0.35 * step;
        skylineXRef.current += 0.7 * step;
        scrollXRef.current += scrollSpeed;
        wingPhaseRef.current += 0.28 * step;

        // Bird vertical physics
        velRef.current += 0.56 * step;
        birdYRef.current += velRef.current * step;

        // Spawn taxi pipes deterministically based on horizontal travel
        distSincePipeRef.current += scrollSpeed;
        if (distSincePipeRef.current >= 210) {
          distSincePipeRef.current = 0;
          const gapHeight = Math.max(126, 146 - Math.floor(scoreRef.current / 5) * 2);
          const minGapTop = 76;
          const maxGapTop = PLAYABLE_BOTTOM - gapHeight - 76;
          const gapTop = minGapTop + Math.random() * (maxGapTop - minGapTop);
          pipesRef.current.push({
            x: CANVAS_WIDTH + 10,
            gapTop,
            gapHeight,
            scored: false,
          });
        }

        // Move pipes & check scoring
        pipesRef.current.forEach((p) => {
          p.x -= scrollSpeed;
          if (!p.scored && p.x + PIPE_WIDTH < BIRD_X) {
            p.scored = true;
            const nextScore = scoreRef.current + 1;
            scoreRef.current = nextScore;
            onScoreChange(nextScore);

            if (nextScore % 5 === 0) {
              sound.playMilestone();
              spawnMilestoneParticles(BIRD_X, birdYRef.current);
            } else {
              sound.playScore();
            }
          }
        });

        // Clean off-screen pipes
        pipesRef.current = pipesRef.current.filter((p) => p.x > -PIPE_WIDTH - 20);

        // Update particles
        particlesRef.current.forEach((p) => {
          p.x += p.vx * step;
          p.y += p.vy * step;
          p.vy += 0.12 * step;
          p.life -= 0.035 * step;
        });
        particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

        // Collision checks (ground / ceiling / pipes)
        const isGrace = now < graceUntilRef.current;
        let collided = false;

        if (birdYRef.current + BIRD_RADIUS >= PLAYABLE_BOTTOM) {
          birdYRef.current = PLAYABLE_BOTTOM - BIRD_RADIUS;
          collided = true;
        } else if (birdYRef.current - BIRD_RADIUS <= 0) {
          birdYRef.current = BIRD_RADIUS;
          velRef.current = 0;
        }

        if (!collided && !isGrace) {
          for (const p of pipesRef.current) {
            const withinX = BIRD_X + BIRD_RADIUS - 3 > p.x && BIRD_X - BIRD_RADIUS + 3 < p.x + PIPE_WIDTH;
            if (withinX) {
              const hitTop = birdYRef.current - BIRD_RADIUS + 3 < p.gapTop;
              const hitBottom = birdYRef.current + BIRD_RADIUS - 3 > p.gapTop + p.gapHeight;
              if (hitTop || hitBottom) {
                collided = true;
                break;
              }
            }
          }
        }

        if (collided) {
          sound.playCrash();
          stateRef.current = 'GAME_OVER';
          onGameOver(scoreRef.current);
        }
      }

      // Draw frame
      ctx.save();
      ctx.scale(dpr, dpr);

      drawSkyAndSun();
      drawClouds(cloudXRef.current);
      drawJoburgSkyline(skylineXRef.current);

      pipesRef.current.forEach((p) => {
        drawTaxiBarrier(p.x, 0, p.gapTop, true);
        const botY = p.gapTop + p.gapHeight;
        drawTaxiBarrier(p.x, botY, PLAYABLE_BOTTOM - botY, false);
      });

      drawParticles();
      drawGround(scrollXRef.current);
      drawBird(BIRD_X, birdYRef.current, velRef.current, now);

      ctx.restore();

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [onGameOver, onScoreChange, spawnMilestoneParticles]);

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={(e) => {
        if (stateRef.current === 'PLAYING') {
          e.preventDefault();
          triggerFlap();
        }
      }}
      className="block w-full h-full touch-none select-none cursor-pointer"
      aria-label="Flappy SA game arena"
    />
  );
};
