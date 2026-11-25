import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Tv, Volume2, VolumeX, Trophy } from 'lucide-react';
import { GameCanvas, CANVAS_WIDTH, CANVAS_HEIGHT } from './components/GameCanvas';
import { DriverPanel } from './components/DriverPanel';
import { GameState, RunRecord } from './types/game';
import { sound } from './utils/sound';

const STORAGE_NAME_KEY = 'flappyName';
const STORAGE_BEST_KEY = 'flappyBest';
const STORAGE_RUNS_KEY = 'flappyRuns';

export default function App() {
  const [driverName, setDriverName] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_NAME_KEY) || '';
    } catch {
      return '';
    }
  });

  const [bestScore, setBestScore] = useState<number>(() => {
    try {
      const val = parseInt(localStorage.getItem(STORAGE_BEST_KEY) || '0', 10);
      return Number.isNaN(val) ? 0 : val;
    } catch {
      return 0;
    }
  });

  const [recentRuns, setRecentRuns] = useState<RunRecord[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_RUNS_KEY);
      return raw ? (JSON.parse(raw) as RunRecord[]) : [];
    } catch {
      return [];
    }
  });

  const [gameState, setGameState] = useState<GameState>('READY');
  const [score, setScore] = useState<number>(0);
  const [isNewBest, setIsNewBest] = useState<boolean>(false);
  const [usedContinue, setUsedContinue] = useState<boolean>(false);
  const [resetToken, setResetToken] = useState<number>(0);
  const [resumeToken, setResumeToken] = useState<number>(0);
  const [adTimer, setAdTimer] = useState<number>(5);
  const [muted, setMuted] = useState<boolean>(false);

  // Quick inline name entry on stage when unregistered
  const [stageNameInput, setStageNameInput] = useState<string>(driverName);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    setStageNameInput(driverName);
  }, [driverName]);

  const handleSaveName = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Type your name first before hitting the road.');
      return false;
    }
    setNameError(null);
    setDriverName(trimmed);
    try {
      localStorage.setItem(STORAGE_NAME_KEY, trimmed);
    } catch {
      // Ignore storage quota issues
    }
    sound.playSuccess();
    return true;
  }, []);

  const startNewRun = useCallback(
    (overrideName?: string) => {
      const activeName = (overrideName ?? driverName).trim();
      if (!activeName) {
        setNameError('Save your driver name first!');
        return;
      }
      setNameError(null);
      setScore(0);
      setIsNewBest(false);
      setUsedContinue(false);
      setResetToken((prev) => prev + 1);
      setGameState('PLAYING');
      sound.playFlap();
    },
    [driverName]
  );

  const handleStageStartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName) {
      const ok = handleSaveName(stageNameInput);
      if (ok) {
        startNewRun(stageNameInput);
      }
    } else {
      startNewRun();
    }
  };

  const handleGameOver = useCallback(
    (finalScore: number) => {
      setScore(finalScore);
      setGameState('GAME_OVER');

      let beatRecord = false;
      if (finalScore > bestScore) {
        beatRecord = true;
        setBestScore(finalScore);
        try {
          localStorage.setItem(STORAGE_BEST_KEY, String(finalScore));
        } catch {
          // Ignore storage error
        }
      }
      setIsNewBest(beatRecord);

      const newRun: RunRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: driverName || 'Driver',
        score: finalScore,
        continued: usedContinue,
        timestamp: Date.now(),
      };

      setRecentRuns((prev) => {
        const updated = [newRun, ...prev].slice(0, 10);
        try {
          localStorage.setItem(STORAGE_RUNS_KEY, JSON.stringify(updated));
        } catch {
          // Ignore storage error
        }
        return updated;
      });
    },
    [bestScore, driverName, usedContinue]
  );

  const handleWatchAd = useCallback(() => {
    setAdTimer(5);
    setGameState('AD_BREAK');
    sound.playTick();
  }, []);

  // Ad break countdown effect
  useEffect(() => {
    if (gameState !== 'AD_BREAK') return;

    const interval = window.setInterval(() => {
      setAdTimer((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          window.clearInterval(interval);
          setUsedContinue(true);
          setResumeToken((t) => t + 1);
          setGameState('PLAYING');
          sound.playSuccess();
          return 0;
        }
        sound.playTick();
        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [gameState]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      sound.setMuted(next);
      return next;
    });
  }, []);

  const togglePause = useCallback(() => {
    setGameState((prev) => {
      if (prev === 'PLAYING') return 'PAUSED';
      if (prev === 'PAUSED') return 'PLAYING';
      return prev;
    });
  }, []);

  const handleClearRuns = useCallback(() => {
    setRecentRuns([]);
    try {
      localStorage.removeItem(STORAGE_RUNS_KEY);
    } catch {
      // Ignore storage error
    }
  }, []);

  // Keyboard shortcuts for Pause (P / Escape) and Quick Start (Space when READY & registered)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (isTyping) return;

      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (gameState === 'PLAYING' || gameState === 'PAUSED') {
          e.preventDefault();
          togglePause();
        }
      } else if (e.code === 'Space' && gameState === 'READY' && driverName) {
        e.preventDefault();
        startNewRun();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [driverName, gameState, startNewRun, togglePause]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      {/* Compact Header Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-display font-extrabold text-lg sm:text-xl tracking-tight text-amber-400 whitespace-nowrap">
              FLAPPY SA
            </span>
            <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
              /
            </span>
            <span className="text-xs sm:text-sm font-medium text-slate-300 truncate hidden sm:inline">
              Taxi Edition · Dodge the Joburg taxis
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-300 font-mono tabular-nums">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Best {bestScore}</span>
            </div>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
              className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Arena + Driver Panel */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 lg:py-10 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8">
        {/* Game Stage Frame */}
        <div className="flex flex-col items-center w-full max-w-[392px] shrink-0">
          <div
            className="relative w-full rounded-2xl overflow-hidden border-[3px] border-slate-900 shadow-2xl shadow-black/60 bg-sky-400 select-none"
            style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
          >
            <GameCanvas
              gameState={gameState}
              resetToken={resetToken}
              resumeToken={resumeToken}
              score={score}
              onScoreChange={setScore}
              onGameOver={handleGameOver}
            />

            {/* Active Gameplay HUD */}
            {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
              <div className="absolute inset-x-0 top-0 p-3 flex items-start justify-between pointer-events-none">
                <div className="bg-slate-950/65 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/15">
                  <span className="text-xs font-medium text-slate-200 truncate max-w-[140px] block">
                    {driverName || 'Driver'}
                  </span>
                </div>

                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePause();
                  }}
                  aria-label={gameState === 'PAUSED' ? 'Resume game' : 'Pause game'}
                  className="pointer-events-auto w-10 h-10 rounded-xl bg-slate-950/70 hover:bg-slate-900 border border-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  {gameState === 'PAUSED' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
              </div>
            )}

            {/* Big Centered Live Score */}
            {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
              <div className="absolute top-14 inset-x-0 text-center pointer-events-none">
                <span className="font-mono tabular-nums text-5xl font-bold text-white drop-shadow-[0_3px_0_rgba(15,23,42,0.95)]">
                  {score}
                </span>
              </div>
            )}

            {/* READY / Title Overlay */}
            {gameState === 'READY' && (
              <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] flex flex-col items-center justify-between p-5 text-center">
                <div className="mt-2 bg-white/95 text-slate-900 border-[3px] border-slate-900 rounded-2xl px-4 py-3 shadow-lg w-full">
                  <h1 className="font-display font-extrabold text-2xl tracking-tight text-slate-950">
                    FLAPPY SA
                  </h1>
                  <p className="text-xs font-semibold text-slate-600 mt-0.5">
                    Taxi Edition · Dodge the taxis! Sharp sharp!
                  </p>
                </div>

                <form
                  onSubmit={handleStageStartSubmit}
                  className="mb-16 bg-white/95 text-slate-900 border-[3px] border-slate-900 rounded-2xl p-4 shadow-xl w-full flex flex-col gap-3"
                >
                  {!driverName ? (
                    <>
                      <div className="text-left">
                        <label
                          htmlFor="stage-driver-name"
                          className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1"
                        >
                          Enter your name
                        </label>
                        <input
                          id="stage-driver-name"
                          type="text"
                          maxLength={20}
                          value={stageNameInput}
                          onChange={(e) => {
                            setStageNameInput(e.target.value);
                            if (nameError) setNameError(null);
                          }}
                          placeholder="Type your name..."
                          className="w-full h-11 px-3 rounded-xl bg-slate-50 border-2 border-slate-900 text-slate-950 placeholder:text-slate-400 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        />
                      </div>
                      {nameError && (
                        <p role="alert" className="text-xs font-semibold text-rose-600 text-left">
                          {nameError}
                        </p>
                      )}
                      <button
                        type="submit"
                        className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] border-[3px] border-slate-900 text-slate-950 font-display font-extrabold text-base transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Play className="w-5 h-5 fill-current" />
                        <span>Save Name & Play</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-sm font-semibold text-slate-700 px-1">
                        <span className="truncate">Driver: {driverName}</span>
                        <span className="font-mono tabular-nums text-amber-600 shrink-0">
                          Best: {bestScore}
                        </span>
                      </div>
                      <button
                        type="submit"
                        className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] border-[3px] border-slate-900 text-slate-950 font-display font-extrabold text-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Play className="w-5 h-5 fill-current" />
                        <span>Play</span>
                      </button>
                      <p className="text-[11px] font-medium text-slate-500">
                        Tap screen or press Space to flap
                      </p>
                    </>
                  )}
                </form>
              </div>
            )}

            {/* PAUSED Overlay */}
            {gameState === 'PAUSED' && (
              <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-5">
                <div className="bg-white text-slate-900 border-[3px] border-slate-900 rounded-2xl p-5 w-full max-w-[300px] text-center shadow-2xl flex flex-col gap-4">
                  <h2 className="font-display font-extrabold text-2xl text-slate-950">
                    Game Paused
                  </h2>
                  <div className="flex flex-col gap-2.5">
                    <button
                      type="button"
                      onClick={togglePause}
                      className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 border-[3px] border-slate-900 text-slate-950 font-display font-bold text-base cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Resume</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setScore(0);
                        setResetToken((t) => t + 1);
                        setGameState('READY');
                      }}
                      className="w-full h-11 rounded-xl bg-slate-100 hover:bg-slate-200 border-2 border-slate-900 text-slate-900 font-semibold text-sm cursor-pointer"
                    >
                      Back to Menu
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* GAME OVER Overlay */}
            {gameState === 'GAME_OVER' && (
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center p-5">
                <div className="bg-white text-slate-900 border-[4px] border-slate-900 rounded-2xl p-5 w-full max-w-[320px] text-center shadow-2xl flex flex-col gap-4">
                  <div>
                    <h2 className="font-display font-extrabold text-2xl text-slate-950">
                      Eish! Game Over!
                    </h2>
                    <p className="text-xs font-medium text-slate-500 mt-1">
                      {driverName || 'Driver'} · M1 Expressway
                    </p>
                  </div>

                  <div className="bg-slate-100 border-2 border-slate-900 rounded-xl p-3.5 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Score
                      </div>
                      <div className="font-mono tabular-nums text-3xl font-extrabold text-slate-950">
                        {score}
                      </div>
                    </div>
                    <div className="border-l border-slate-300 pl-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Best
                      </div>
                      <div className="font-mono tabular-nums text-3xl font-extrabold text-amber-600">
                        {bestScore}
                      </div>
                    </div>
                  </div>

                  {isNewBest && score > 0 && (
                    <p className="text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 rounded-lg py-1.5 px-3">
                      New Personal Best! Sharp sharp!
                    </p>
                  )}

                  <div className="flex flex-col gap-2.5">
                    <button
                      type="button"
                      onClick={() => startNewRun()}
                      className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] border-[3px] border-slate-900 text-slate-950 font-display font-extrabold text-base transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Restart</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleWatchAd}
                      className="w-full h-12 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.98] border-[3px] border-slate-900 text-slate-950 font-display font-extrabold text-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Tv className="w-4 h-4" />
                      <span>Watch Ad to Continue</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* AD BREAK Overlay */}
            {gameState === 'AD_BREAK' && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-5">
                <div className="bg-slate-900 text-white border-[4px] border-amber-400 rounded-2xl p-6 w-full max-w-[310px] text-center shadow-2xl flex flex-col items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-400/15 text-amber-400 flex items-center justify-center">
                    <Tv className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-xl text-white">
                      Ad Playing...
                    </h3>
                    <p className="text-sm text-slate-300 mt-1">
                      Supporting Flappy SA! Clearing the road ahead.
                    </p>
                  </div>

                  <div className="w-20 h-20 rounded-full border-4 border-amber-400 bg-slate-950 flex items-center justify-center">
                    <span className="font-mono tabular-nums text-4xl font-extrabold text-amber-400">
                      {adTimer}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">
                    Resuming from score <span className="font-mono font-bold text-white">{score}</span>...
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Side Driver Panel */}
        <DriverPanel
          driverName={driverName}
          bestScore={bestScore}
          recentRuns={recentRuns}
          onSaveName={handleSaveName}
          onClearRuns={handleClearRuns}
          nameError={nameError}
          onClearNameError={() => setNameError(null)}
        />
      </main>
    </div>
  );
}
