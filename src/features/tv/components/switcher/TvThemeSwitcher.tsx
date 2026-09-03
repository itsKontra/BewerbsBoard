import { useEffect, useState } from 'react';
import type { TvTheme } from '../../../../../shared/domain/tv-presentation';
import { Radio, Sparkles, Sun, Palette, ChevronUp, ChevronDown } from 'lucide-react';

export interface TvThemeSwitcherProps {
  currentTheme: TvTheme;
  onSelectTheme: (theme: TvTheme) => void;
}

interface ThemeOption {
  id: TvTheme;
  keyNum: string;
  name: string;
  sublabel: string;
  icon: typeof Radio;
  accentHex: string;
  activeClass: string;
  dotClass: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'broadcast',
    keyNum: '1',
    name: 'Broadcast',
    sublabel: 'Live Telemetry',
    icon: Radio,
    accentHex: '#00e5ff',
    activeClass: 'bg-cyan-400 text-slate-950 font-black shadow-[0_0_14px_rgba(0,229,255,0.45)] ring-1 ring-cyan-200',
    dotClass: 'bg-cyan-400',
  },
  {
    id: 'ceremony',
    keyNum: '2',
    name: 'Ceremony',
    sublabel: 'Gala Siegerehrung',
    icon: Sparkles,
    accentHex: '#f59e0b',
    activeClass: 'bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 font-black shadow-[0_0_14px_rgba(245,158,11,0.5)] ring-1 ring-amber-200',
    dotClass: 'bg-amber-400',
  },
  {
    id: 'outdoor',
    keyNum: '3',
    name: 'Outdoor',
    sublabel: 'High-Sun Stadium HUD',
    icon: Sun,
    accentHex: '#ea580c',
    activeClass: 'bg-gradient-to-r from-orange-500 to-orange-600 text-white font-black shadow-[0_0_14px_rgba(234,88,12,0.45)] ring-1 ring-orange-300',
    dotClass: 'bg-orange-500',
  },
];

export function TvThemeSwitcher({
  currentTheme,
  onSelectTheme,
}: TvThemeSwitcherProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  // Keyboard shortcut support [1, 2, 3]
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing into an input or textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key === '1') {
        onSelectTheme('broadcast');
      } else if (e.key === '2') {
        onSelectTheme('ceremony');
      } else if (e.key === '3') {
        onSelectTheme('outdoor');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectTheme]);

  const activeOption = THEME_OPTIONS.find((t) => t.id === currentTheme) || THEME_OPTIONS[0];

  if (isMinimized) {
    return (
      <aside
        aria-label="Theme Switcher (Minimized)"
        data-testid="tv-theme-switcher"
        className="fixed bottom-3 right-3 z-50 select-none font-sans"
      >
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          title={`Thema: ${activeOption.name} (Klicken zum Öffnen)`}
          aria-label="Themen-Umschalter öffnen"
          className="flex h-10 items-center gap-2 rounded-full border border-white/20 bg-slate-950/90 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xl backdrop-blur-xl transition-transform duration-200 hover:scale-105 cursor-pointer"
        >
          <Palette className="h-4 w-4" style={{ color: activeOption.accentHex }} />
          <span>{activeOption.name}</span>
          <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Theme Switcher Prototype"
      data-testid="tv-theme-switcher"
      className="fixed bottom-3 right-3 z-50 flex items-center gap-1.5 rounded-2xl border border-white/20 bg-slate-950/90 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.85)] backdrop-blur-2xl select-none font-sans"
    >
      <div className="flex items-center gap-1.5 pl-2 pr-1 text-slate-400">
        <Palette className="h-4 w-4 text-slate-300 shrink-0" />
        <span className="hidden sm:inline-block text-[11px] font-black uppercase tracking-wider text-slate-300">
          Thema
        </span>
      </div>

      <div className="flex items-center gap-1 rounded-xl bg-slate-900/90 p-0.5 border border-white/10" role="tablist">
        {THEME_OPTIONS.map((option) => {
          const isActive = currentTheme === option.id;
          const Icon = option.icon;

          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`Theme ${option.keyNum}: ${option.name} (${option.sublabel})`}
              title={`${option.name} • ${option.sublabel} (Taste [${option.keyNum}])`}
              onClick={() => onSelectTheme(option.id)}
              className={`relative flex h-8 items-center gap-1.5 rounded-lg px-2.5 sm:px-3 text-xs font-black transition-all duration-200 cursor-pointer ${
                isActive
                  ? `${option.activeClass} scale-[1.02]`
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-inherit' : 'text-slate-400'}`} />
              <span>{option.name}</span>
              <span className={`text-[10px] font-mono opacity-70 ${isActive ? 'text-inherit' : 'text-slate-400'}`}>
                [{option.keyNum}]
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setIsMinimized(true)}
        aria-label="Themen-Umschalter minimieren"
        title="Minimieren"
        className="flex h-8 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
    </aside>
  );
}
