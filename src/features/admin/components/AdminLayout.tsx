import React, { useState, useEffect, useRef } from 'react';
import { ADMIN_TABS, type AdminTabId } from './admin-tabs';
import { uiText } from '../../../ui-text';
export type { AdminTabId };

export interface AdminLayoutProps {
  userEmail?: string;
  defaultTab?: AdminTabId;
  onTabChange?: (tab: AdminTabId) => void;
  onLogout?: () => void;
  /** Called once on mount with a stable navigate(tab) function. Use this to programmatically switch tabs from outside AdminLayout. */
  onReady?: (navigate: (tab: AdminTabId) => void) => void;
  children?: React.ReactNode | ((activeTab: AdminTabId) => React.ReactNode);
}

const BrandHeader = () => (
  <div className="flex items-center space-x-3 p-4 shrink-0 border-b border-neutral-800">
    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white shadow-lg shadow-red-900/30 border border-red-500/30 shrink-0">
      <span className="text-xl font-bold tracking-wider">{uiText.common.brandMark}</span>
    </div>
    <div className="overflow-hidden">
      <div className="flex items-center space-x-2">
        <h1 className="text-base sm:text-lg font-black tracking-wider text-white uppercase font-sans truncate">
          {uiText.common.scoreboard}
        </h1>
        <span className="px-1.5 py-0.5 text-[10px] sm:text-xs font-semibold bg-red-950 text-red-400 border border-red-800/60 rounded-full tracking-wide">
          {uiText.common.adminBadge}
        </span>
      </div>
    </div>
  </div>
);

const UserMenu = ({ currentUser, onLogout }: { currentUser: string; onLogout: () => void }) => (
  <div className="flex flex-col space-y-3 mt-auto p-4 border-t border-neutral-800">
    <div className="flex flex-col space-y-1.5 text-xs sm:text-sm">
      <a href="/" target="_blank" rel="noreferrer" className="inline-flex items-center space-x-2 px-3 py-2 rounded-md bg-neutral-800/60 hover:bg-neutral-700/80 text-neutral-300 transition-colors border border-neutral-700/60 font-medium">
        <span>📱</span><span>{uiText.adminLayout.audienceView}</span>
      </a>
      <a href="/tv" target="_blank" rel="noreferrer" className="inline-flex items-center space-x-2 px-3 py-2 rounded-md bg-neutral-800/60 hover:bg-neutral-700/80 text-neutral-300 transition-colors border border-neutral-700/60 font-medium">
        <span>📺</span><span>{uiText.adminLayout.tvDisplay}</span>
      </a>
    </div>
    <div className="flex items-center space-x-2 bg-neutral-950 border border-neutral-800 px-3 py-2 rounded-lg">
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
      <span className="text-neutral-300 font-mono font-medium truncate text-xs sm:text-sm" title={currentUser}>
        {currentUser}
      </span>
    </div>
    <button type="button" onClick={onLogout} className="inline-flex justify-center items-center space-x-2 px-3 py-2 rounded-md bg-red-950/60 hover:bg-red-900/80 text-red-300 transition-colors border border-red-800/60 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500/50">
      <span>🚪</span><span>{uiText.common.logout}</span>
    </button>
  </div>
);

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  userEmail: userEmailProp,
  defaultTab = 'results',
  onTabChange,
  onLogout,
  onReady,
  children,
}) => {
  const [currentTab, setCurrentTab] = useState<AdminTabId>(defaultTab);
  const [currentUser, setCurrentUser] = useState<string>(userEmailProp ?? 'admin@feuerwehr.at');
  const [authMode, setAuthMode] = useState<'local' | 'proxy'>('proxy');
  const [logoutUrl, setLogoutUrl] = useState<string>('/oauth2/sign_out?rd=/admin');

  const handleLogout = async () => {
    if (authMode === 'local') {
      try {
        await fetch('/local-auth/logout', { method: 'POST' });
      } catch { /* ignore */ }
      if (onLogout) onLogout();
      else window.location.reload();
    } else {
      window.location.href = logoutUrl || '/oauth2/sign_out?rd=/admin';
    }
  };

  // Drawer Refs
  const drawerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const openBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (userEmailProp) {
      setCurrentUser(userEmailProp);
      return;
    }

    let isMounted = true;
    fetch('/api/admin/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) {
          if (data.user) setCurrentUser(data.user);
          if (data.authMode) setAuthMode(data.authMode);
          if (data.logoutUrl) setLogoutUrl(data.logoutUrl);
        }
      })
      .catch(() => { /* keep fallback */ });

    return () => { isMounted = false; };
  }, [userEmailProp]);

  // Drawer Setup & Observers
  useEffect(() => {
    if (!drawerRef.current || !sheetRef.current || !openBtnRef.current) return;
    const singlePixelIntersectionThreshold = 1 / window.innerWidth;
    
    const observer = new IntersectionObserver((entries) => {
      const entry = entries.at(-1);
      if (!entry) return;
      if (entry.intersectionRatio < singlePixelIntersectionThreshold) {
        // Drawer is closed
        drawerRef.current?.hidePopover();
        const main = document.querySelector('main');
        if (main) main.inert = false;
        if (openBtnRef.current) openBtnRef.current.setAttribute('aria-expanded', 'false');
      }
      if (entry.intersectionRatio === 1) {
        // Drawer is open
        const main = document.querySelector('main');
        if (main) main.inert = true;
        if (openBtnRef.current) openBtnRef.current.setAttribute('aria-expanded', 'true');
        sheetRef.current?.focus();
      }
    }, { root: drawerRef.current, threshold: [singlePixelIntersectionThreshold, 1]});

    observer.observe(sheetRef.current);
    return () => observer.disconnect();
  }, []);


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const openDrawer = async () => {
    if (drawerRef.current && scrollerRef.current) {
      drawerRef.current.showPopover();
      if (!CSS.supports('scroll-initial-target', 'nearest')) {
        scrollerRef.current.scrollTo({ left: scrollerRef.current.offsetWidth, behavior: 'instant' });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }
      scrollerRef.current.scrollTo({ left: 0, behavior: 'auto' });
    }
  };

  const closeDrawer = () => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTo({ left: scrollerRef.current.offsetWidth, behavior: 'auto' });
    }
  };

  const handleTabClick = (tabId: AdminTabId) => {
    setCurrentTab(tabId);
    onTabChange?.(tabId);
    // Auto-close drawer on mobile when clicking a tab
    closeDrawer();
  };

  // Fire onReady with navigate function so external components (e.g. BroadcastTab) can switch tabs
  useEffect(() => {
    onReady?.(handleTabClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const activeTabConfig = ADMIN_TABS.find((t) => t.id === currentTab) ?? ADMIN_TABS[0];

  const NavigationList = () => (
    <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 scrollbar-gutter-stable" aria-label={uiText.adminLayout.navigationLabel}>
      {ADMIN_TABS.map((tab) => {
        const isActive = tab.id === currentTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => handleTabClick(tab.id)}
            className={`w-full text-left px-3 py-2.5 rounded-md text-sm font-semibold transition-all duration-150 flex items-center space-x-3 focus:outline-none focus:ring-2 focus:ring-red-500/50 ${
              isActive
                ? 'bg-red-600/90 text-white shadow-md shadow-red-950/50 border border-red-500/40'
                : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/60 border border-transparent'
            }`}
          >
            <span className="text-lg w-6 text-center">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex font-sans selection:bg-red-700 selection:text-white md:grid md:grid-cols-[260px_1fr]">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col bg-neutral-900/90 border-r border-neutral-800 h-screen sticky top-0">
        <BrandHeader />
        <NavigationList />
        <UserMenu currentUser={currentUser} onLogout={handleLogout} />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden md:grid md:grid-rows-[auto_1fr] md:grid-cols-subgrid">
        {/* Mobile Header */}
        <header className="md:hidden shrink-0 h-16 bg-neutral-900/95 border-b border-neutral-800 flex items-center justify-between px-4 z-10 md:col-start-2">
          <BrandHeader />
          <button 
            ref={openBtnRef}
            id="drawer-open"
            aria-controls="drawer"
            aria-expanded="false"
            aria-label={uiText.adminLayout.openMenu}
            onClick={openDrawer}
            className="p-2 -mr-2 text-neutral-400 hover:text-white focus:outline-none"
          >
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </header>

        {/* Scrollable Main */}
        <main className="flex-1 overflow-y-auto overscroll-contain bg-neutral-950 relative">
          <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            <header className="mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <span>{activeTabConfig.icon}</span>
                {activeTabConfig.label}
              </h2>
              <p className="text-sm text-neutral-400 mt-1">{activeTabConfig.description}</p>
            </header>

            <div role="tabpanel">
              {(() => {
                const content = typeof children === 'function' ? children(currentTab) : children;
                if (content) return content;
                return (
                  <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
                    <div className="w-12 h-12 rounded-full bg-neutral-800/80 flex items-center justify-center text-2xl mb-3 text-neutral-400">
                      {activeTabConfig.icon}
                    </div>
                    <h3 className="text-lg font-bold text-neutral-200">
                      {uiText.adminLayout.moduleTitle(activeTabConfig.label)}
                    </h3>
                    <div className="mt-4 px-3 py-1 bg-neutral-800/50 border border-neutral-700/50 rounded-full text-xs text-neutral-400">
                      {uiText.adminLayout.readyForTicketImplementation}
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <footer className="pt-12 pb-4 text-center text-xs text-neutral-600">
              {uiText.adminLayout.footer(new Date().getFullYear())}
            </footer>
          </div>
        </main>
      </div>

      {/* Mobile Drawer (Popover) */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <div 
        className="Drawer md:hidden" 
        id="drawer" 
        ref={drawerRef} 
        popover="manual" 
        onClick={(e) => {
          if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) closeDrawer();
        }}
      >
        <div className="Drawer-scroller" ref={scrollerRef}>
          <nav className="Drawer-sheet bg-neutral-900 flex flex-col w-full max-w-sm" ref={sheetRef} tabIndex={-1}>
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
              <BrandHeader />
              <button 
                onClick={closeDrawer}
                className="p-2 -mr-2 text-neutral-400 hover:text-white focus:outline-none"
                aria-label={uiText.adminLayout.closeMenu}
              >
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <NavigationList />
            <UserMenu currentUser={currentUser} onLogout={handleLogout} />
          </nav>
        </div>
      </div>
    </div>
  );
};
