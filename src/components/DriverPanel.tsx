import React, { useState, useEffect, useRef } from 'react';
import { Trophy, User, Check, RotateCcw } from 'lucide-react';
import { RunRecord } from '../types/game';

interface DriverPanelProps {
  driverName: string;
  bestScore: number;
  recentRuns: RunRecord[];
  onSaveName: (name: string) => void;
  onClearRuns: () => void;
  nameError: string | null;
  onClearNameError: () => void;
}

export const DriverPanel: React.FC<DriverPanelProps> = ({
  driverName,
  bestScore,
  recentRuns,
  onSaveName,
  onClearRuns,
  nameError,
  onClearNameError,
}) => {
  const [inputValue, setInputValue] = useState(driverName);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setInputValue(driverName);
  }, [driverName]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) {
      onSaveName('');
      return;
    }
    onSaveName(trimmed);
    setSavedNotice(`Sharp sharp, ${trimmed}! Ready to roll.`);
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => setSavedNotice(null), 2600);
  };

  return (
    <aside className="flex flex-col gap-6 w-full lg:w-[360px] shrink-0">
      {/* Driver Registration & Best Score */}
      <section className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400/15 text-amber-400 flex items-center justify-center shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-slate-50 leading-tight">
                Driver Registration
              </h2>
              <p className="text-xs text-slate-400">
                Saved locally to your browser
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Personal Best
            </div>
            <div className="font-mono tabular-nums text-xl font-bold text-amber-400 flex items-center justify-end gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>{bestScore}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
          <label htmlFor="driver-name-input" className="sr-only">
            Enter your name
          </label>
          <div className="flex gap-2">
            <input
              id="driver-name-input"
              type="text"
              maxLength={20}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (nameError) onClearNameError();
              }}
              placeholder="Type your name..."
              className="flex-1 min-w-0 h-11 px-3.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-50 placeholder:text-slate-500 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            />
            <button
              type="submit"
              className="h-11 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-slate-950 font-semibold text-sm transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Save</span>
            </button>
          </div>

          {nameError && (
            <p role="alert" className="text-xs font-medium text-rose-400">
              {nameError}
            </p>
          )}
          {savedNotice && !nameError && (
            <p className="text-xs font-medium text-emerald-400">
              {savedNotice}
            </p>
          )}
        </form>

        <div className="pt-2 border-t border-slate-700/70 flex items-center justify-between text-xs text-slate-400">
          <span>Active Driver</span>
          <span className="font-semibold text-slate-100 truncate max-w-[180px]">
            {driverName || 'Unregistered'}
          </span>
        </div>
      </section>

      {/* Controls Guide */}
      <section className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 flex flex-col gap-3">
        <h2 className="font-display font-bold text-base text-slate-50">
          How to Fly
        </h2>
        <ul className="flex flex-col gap-2 text-sm text-slate-300">
          <li className="flex items-center justify-between gap-3">
            <span>Flap upward</span>
            <span className="font-mono text-xs text-amber-300">Tap · Click · Space</span>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span>Pause / Resume</span>
            <span className="font-mono text-xs text-slate-400">P or Esc</span>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span>Second chance</span>
            <span className="font-mono text-xs text-emerald-400">5s Ad Break</span>
          </li>
        </ul>
      </section>

      {/* Recent Runs */}
      <section className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-base text-slate-50">
            Recent Runs
          </h2>
          {recentRuns.length > 0 && (
            <button
              type="button"
              onClick={onClearRuns}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {recentRuns.length === 0 ? (
          <p className="text-sm text-slate-400 py-2">
            No runs logged yet. Dodge the Joburg taxis to set your first score.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-slate-700/60">
            {recentRuns.slice(0, 5).map((run, idx) => (
              <div
                key={run.id}
                className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono tabular-nums text-xs text-slate-500 w-4">
                    {idx + 1}.
                  </span>
                  <span className="font-medium text-slate-200 truncate">
                    {run.name}
                  </span>
                  {run.continued && (
                    <span className="text-[11px] text-amber-400/90 shrink-0">
                      · Continued
                    </span>
                  )}
                </div>
                <span className="font-mono tabular-nums font-bold text-amber-400 shrink-0">
                  {run.score}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
};
