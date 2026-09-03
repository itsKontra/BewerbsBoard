import React, { useState, useEffect, useRef } from 'react';
import { ADMIN_TABS, type AdminTabId } from './admin-tabs';
import { uiText } from '../../../ui-text';
import { Timer, Users, Radio, LayoutGrid, Settings, ScrollText, LogOut, Smartphone, Tv, ChevronRight, Menu, X, CircleUser } from 'lucide-react';

export type { AdminTabId };

export interface AdminLayoutProps {
  userEmail?: string;
  defaultTab?: AdminTabId;
  onTabChange?: (tab: AdminTabId) => void;
  onLogout?: () => void;
  onReady?: (navigate: (tab: AdminTabId) => void) => void;
  children?: React.ReactNode | ((activeTab: AdminTabId) => React.ReactNode);
}

const iconMap: Record<string, React.FC<any>> = {
  Timer,
  Users,
  Radio,
  LayoutGrid,
  Settings,
  ScrollText,
};

const BrandHeader = () => (
  <div className="flex items-center space-x-3 px-5 py-4 border-b border-slate-100 shrink-0">
    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-slate-900 flex items-center justify-center text-white shadow-xs shrink-0 font-bold text-sm tracking-wider">
      {uiText.common.brandMark}
    </div>
    <div className="overflow-hidden min-w-0">
      <h1 className="text-base font-black text-slate-900 tracking-tight leading-none truncate">
        {uiText.common.scoreboard}
      </h1>
      <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mt-0.5 block">
        {uiText.common.adminBadge} PANEL
      </span>
    </div>
  </div>
);

const UserMenu = ({ currentUser, onLogout }: { currentUser: string; onLogout: () => void }) => (
  <div className="mt-auto p-3 border-t border-slate-100 bg-slate-50/70 flex flex-col space-y-2 shrink-0">
    <div className="grid grid-cols-2 gap-1.5">
      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center space-x-1.5 px-2 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 hover:text-indigo-600 border border-slate-200/80 text-[11px] font-semibold transition-colors shadow-2xs text-center"
      >
        <Smartphone size={13} className="text-slate-400" />
        <span className="truncate">{uiText.adminLayout.audienceView}</span>
      </a>
      <a
        href="/tv"
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center space-x-1.5 px-2 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 hover:text-indigo-600 border border-slate-200/80 text-[11px] font-semibold transition-colors shadow-2xs text-center"
      >
        <Tv size={13} className="text-slate-400" />
        <span className="truncate">{uiText.adminLayout.tvDisplay}</span>
      </a>
    </div>

    <div className="flex items-center p-2 bg-white border border-slate-200/70 rounded-lg shadow-2xs">
      <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
        <CircleUser size={14} />
      </div>
      <div className="ml-2 overflow-hidden flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-700 truncate" title={currentUser}>{currentUser}</p>
        <p className="text-[10px] text-slate-400 leading-tight">Administrator</p>
      </div>
    </div>

    <button
      type="button"
      onClick={onLogout}
      className="flex items-center justify-center space-x-1.5 w-full px-2.5 py-1.5 rounded-lg bg-slate-200/80 hover:bg-red-50 hover:text-red-700 text-slate-700 transition-colors text-xs font-semibold cursor-pointer"
    >
      <LogOut size={13} />
      <span>{uiText.common.logout}</span>
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
      try { await fetch('/local-auth/logout', { method: 'POST' }); } catch { /* ignore */ }
      if (onLogout) onLogout();
      else window.location.reload();
    } else {
      window.location.href = logoutUrl || '/oauth2/sign_out?rd=/admin';
    }
  };

  const drawerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);

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
      .catch(() => {});
    return () => { isMounted = false; };
  }, [userEmailProp]);

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
    closeDrawer();
  };

  useEffect(() => {
    onReady?.(handleTabClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeTabConfig = ADMIN_TABS.find((t) => t.id === currentTab) ?? ADMIN_TABS[0];

  const NavigationList = () => (
    <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1 scrollbar-gutter-stable" aria-label={uiText.adminLayout.navigationLabel}>
      <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        Menü
      </div>
      <div className="space-y-1">
        {ADMIN_TABS.map((tab) => {
          const isActive = tab.id === currentTab;
          const IconComponent = iconMap[tab.icon] || LayoutGrid;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabClick(tab.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center space-x-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <IconComponent size={16} className={isActive ? 'text-indigo-400' : 'text-slate-400'} />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );

  return (
    <div className="h-screen w-screen bg-slate-100/80 flex font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden text-slate-800">
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col bg-white w-60 shrink-0 border-r border-slate-200/80 z-20 shadow-2xs">
        <BrandHeader />
        <NavigationList />
        <UserMenu currentUser={currentUser} onLogout={handleLogout} />
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        
        {/* Mobile Header */}
        <header className="md:hidden shrink-0 h-14 bg-white border-b border-slate-200/80 flex items-center justify-between px-4 z-20">
          <BrandHeader />
          <button onClick={openDrawer} className="p-2 -mr-1 text-slate-500 hover:text-indigo-600 focus:outline-none bg-slate-50 rounded-lg">
            <Menu size={20} />
          </button>
        </header>

        {/* Top Operational Bar (Desktop) */}
        <header className="hidden md:flex items-center justify-between px-6 h-12 bg-white border-b border-slate-200/80 sticky top-0 z-10 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-1 rounded-md bg-indigo-50 text-indigo-600">
              {React.createElement(iconMap[activeTabConfig.icon] || LayoutGrid, { size: 15 })}
            </div>
            <div className="flex items-center text-xs font-medium text-slate-500">
              <span className="text-slate-400">Dashboard</span>
              <ChevronRight size={12} className="mx-1 text-slate-300" />
              <span className="text-slate-900 font-bold">{activeTabConfig.label}</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
            >
              <Smartphone size={13} className="text-slate-400" />
              <span>{uiText.adminLayout.audienceView}</span>
            </a>
            <a
              href="/tv"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
            >
              <Tv size={13} className="text-slate-400" />
              <span>{uiText.adminLayout.tvDisplay}</span>
            </a>
            <div className="h-3.5 w-px bg-slate-200" />
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-[10px] select-none">
                {(currentUser.charAt(0) || 'A').toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-slate-700 truncate max-w-44" title={currentUser}>
                {currentUser}
              </span>
            </div>
          </div>
        </header>

        {/* Scrollable Main Workspace */}
        <main className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5 lg:p-6 pb-12">
          <div className="max-w-[1600px] mx-auto">
            <div role="tabpanel">
              {(() => {
                const content = typeof children === 'function' ? children(currentTab) : children;
                if (content) return content;
                return (
                  <div className="bg-white border border-slate-200/80 rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[360px] shadow-xs">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-4 text-indigo-600">
                      {React.createElement(iconMap[activeTabConfig.icon] || LayoutGrid, { size: 24 })}
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1">
                      {uiText.adminLayout.moduleTitle(activeTabConfig.label)}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                      {activeTabConfig.description}
                    </p>
                    <div className="px-3 py-1 bg-slate-100 rounded-full text-[11px] font-semibold text-slate-500">
                      {uiText.adminLayout.readyForTicketImplementation}
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <footer className="mt-8 text-center text-[11px] text-slate-400 font-medium">
              {uiText.adminLayout.footer(new Date().getFullYear())}
            </footer>
          </div>
        </main>
      </div>

      {/* Mobile Drawer (Popover) */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <div 
        className="Drawer md:hidden z-50" 
        id="drawer" 
        ref={drawerRef} 
        popover="manual" 
        onClick={(e) => {
          if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) closeDrawer();
        }}
      >
        <div className="Drawer-scroller" ref={scrollerRef}>
          <nav className="Drawer-sheet bg-white flex flex-col w-full max-w-xs shadow-2xl" ref={sheetRef} tabIndex={-1}>
            <div className="p-3 flex items-center justify-between bg-white z-10 sticky top-0 border-b border-slate-100">
              <BrandHeader />
              <button onClick={closeDrawer} className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-50 rounded-lg focus:outline-none">
                <X size={18} />
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
