import { useState, useEffect, useRef } from 'react';
import { Tv } from 'lucide-react';

import { type TvIterationId, TV_ITERATIONS } from './tv-iteration-types';
export type { TvIterationId, TvIterationInfo } from './tv-iteration-types';

export interface TvIterationSwitcherProps {
  currentIteration: TvIterationId;
  onSelectIteration: (iteration: TvIterationId) => void;
}

export function TvIterationSwitcher({
  currentIteration,
  onSelectIteration,
}: TvIterationSwitcherProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dim when mouse is idle on TV screen
  useEffect(() => {
    const resetIdle = () => {
      setIsIdle(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        setIsIdle(true);
      }, 4000);
    };

    window.addEventListener('mousemove', resetIdle, { passive: true });
    window.addEventListener('touchstart', resetIdle, { passive: true });
    resetIdle();

    return () => {
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('touchstart', resetIdle);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  // Keyboard shortcut listener: '1', '2', '3'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === '1') {
        onSelectIteration(1);
      } else if (e.key === '2') {
        onSelectIteration(2);
      } else if (e.key === '3') {
        onSelectIteration(3);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectIteration]);

  const activeInfo = TV_ITERATIONS[currentIteration];

  return (
    <aside
      aria-label="TV Layout Switcher"
      className={`fixed bottom-4 right-4 z-50 select-none transition-all duration-300 ${
        isIdle && !isHovered ? 'opacity-25 hover:opacity-100' : 'opacity-100'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-2 rounded-2xl border border-white/20 bg-slate-950/85 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        {/* TV Icon & Current label */}
        <div className="flex items-center gap-2 px-2.5 py-1 text-xs font-semibold text-white/90">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/10 text-white">
            <Tv className="h-3.5 w-3.5" />
          </span>
          <span className="hidden sm:inline font-mono text-[11px] uppercase tracking-wider text-white/60">
            Layout:
          </span>
          <span className="hidden md:inline font-bold text-white">
            {activeInfo.name}
          </span>
        </div>

        {/* Buttons 1, 2, 3 */}
        <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1" role="tablist" aria-label="TV Screen Layouts">
          {([1, 2, 3] as TvIterationId[]).map((id) => {
            const info = TV_ITERATIONS[id];
            const isActive = currentIteration === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Iteration ${id}: ${info.name}`}
                title={`${info.name} • ${info.tagline} (Taste [${id}])`}
                onClick={() => onSelectIteration(id)}
                className={`relative flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-black transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-950 shadow-md ring-2 ring-white/50 scale-105'
                    : 'text-white/70 hover:bg-white/15 hover:text-white'
                }`}
              >
                <span>{id}</span>
                {isActive && (
                  <span
                    className="h-1.5 w-1.5 rounded-full animate-pulse"
                    style={{ backgroundColor: info.accentColor }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Quick shortcut indicator */}
        <div className="hidden lg:flex items-center px-2 font-mono text-[10px] text-white/40">
          Taste [1-3]
        </div>
      </div>
    </aside>
  );
}
