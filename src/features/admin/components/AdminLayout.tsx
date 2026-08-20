import React, { useState, useEffect, useRef } from 'react';
import { ADMIN_TABS, type AdminTabId } from './admin-tabs';
import { uiText } from '../../../ui-text';
import { Timer, Users, Radio, LayoutGrid, Settings, ScrollText, LogOut, Smartphone, Tv, ChevronRight, Menu, X, Search, Bell, CircleUser } from 'lucide-react';

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
  <div className="flex items-center space-x-3 p-6 shrink-0">
    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/30 shrink-0">
      <span className="text-xl font-bold tracking-wider">{uiText.common.brandMark}</span>
    </div>
    <div className="overflow-hidden">
      <div className="flex flex-col">
        <h1 className="text-lg font-bold text-slate-800 tracking-tight leading-tight truncate">
          {uiText.common.scoreboard}
        </h1>
        <span className="text-xs font-medium text-slate-500 tracking-wide uppercase">
          Admin Panel
        </span>
      </div>
    </div>
  </div>
);

const UserMenu = ({ currentUser, onLogout }: { currentUser: string; onLogout: () => void }) => (
  <div className="flex flex-col space-y-4 mt-auto p-6 border-t border-slate-100 bg-slate-50/50">
    <div className="flex flex-col space-y-2">
      <a href="/" target="_blank" rel="noreferrer" className="flex items-center space-x-3 px-4 py-2.5 rounded-xl hover:bg-white text-slate-600 hover:text-indigo-600 transition-all hover:shadow-sm font-medium text-sm group border border-transparent hover:border-slate-100">
        <Smartphone size={18} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
        <span>{uiText.adminLayout.audienceView}</span>
      </a>
      <a href="/tv" target="_blank" rel="noreferrer" className="flex items-center space-x-3 px-4 py-2.5 rounded-xl hover:bg-white text-slate-600 hover:text-indigo-600 transition-all hover:shadow-sm font-medium text-sm group border border-transparent hover:border-slate-100">
        <Tv size={18} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
        <span>{uiText.adminLayout.tvDisplay}</span>
      </a>
    </div>
    
    <div className="flex items-center p-3 bg-white border border-slate-100 rounded-xl shadow-sm mt-4">
      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
        <CircleUser size={18} />
      </div>
      <div className="ml-3 overflow-hidden flex-1">
        <p className="text-sm font-medium text-slate-700 truncate" title={currentUser}>{currentUser}</p>
        <p className="text-xs text-slate-500">Administrator</p>
      </div>
    </div>

    <button type="button" onClick={onLogout} className="flex items-center justify-center space-x-2 w-full px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors font-medium text-sm">
      <LogOut size={16} />
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
    <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-8 scrollbar-gutter-stable" aria-label={uiText.adminLayout.navigationLabel}>
      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2">Main Menu</h4>
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
                className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 flex items-center space-x-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                  isActive
                    ? 'bg-slate-100 text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <IconComponent size={20} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden text-slate-800">
      
      {/* Floating Container Wrapper */}
      <div className="flex-1 flex flex-col md:flex-row h-screen w-full max-w-[1920px] mx-auto overflow-hidden md:p-4 lg:p-6 transition-all duration-300">
        
        {/* Desktop Sidebar (Inside floating pane on lg, edge-to-edge on md) */}
        <aside className="hidden md:flex flex-col bg-white w-72 shrink-0 md:rounded-l-3xl border-r border-slate-100 z-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <BrandHeader />
          <NavigationList />
          <UserMenu currentUser={currentUser} onLogout={handleLogout} />
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full bg-slate-50 md:rounded-r-3xl md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden relative">
          
          {/* Mobile Header */}
          <header className="md:hidden shrink-0 h-20 bg-white border-b border-slate-100 flex items-center justify-between px-6 z-10 rounded-b-3xl shadow-sm">
            <BrandHeader />
            <button onClick={openDrawer} className="p-2 -mr-2 text-slate-500 hover:text-indigo-600 focus:outline-none bg-slate-50 rounded-xl">
              <Menu size={24} />
            </button>
          </header>

          {/* Top Bar (Desktop) */}
          <header className="hidden md:flex items-center justify-between px-8 py-6 bg-slate-50/80 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center text-sm font-medium text-slate-500">
              <span>Dashboard</span>
              <ChevronRight size={16} className="mx-2 text-slate-400" />
              <span className="text-slate-800 font-semibold">{activeTabConfig.label}</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Search..." className="pl-10 pr-4 py-2.5 rounded-full bg-white border border-slate-200 text-sm focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 transition-all w-64 shadow-sm" />
              </div>
              <button className="p-2.5 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 shadow-sm transition-all">
                <Bell size={18} />
              </button>
            </div>
          </header>

          {/* Scrollable Main */}
          <main className="flex-1 overflow-y-auto overscroll-contain pb-12">
            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
              
              <div className="mb-8 pl-2">
                <h2 className="text-3xl font-bold text-slate-800 tracking-tight">
                  Hello <span className="text-indigo-600">{currentUser.split('@')[0]}</span>,
                </h2>
                <p className="text-sm text-slate-500 mt-2 flex items-center">
                  <span>Welcome to the new Admin Panel.</span>
                </p>
              </div>

              <div role="tabpanel" className="space-y-6">
                {(() => {
                  const content = typeof children === 'function' ? children(currentTab) : children;
                  if (content) return content;
                  return (
                    <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[400px] shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                      <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-6 text-indigo-500">
                        {React.createElement(iconMap[activeTabConfig.icon] || LayoutGrid, { size: 32 })}
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 mb-2">
                        {uiText.adminLayout.moduleTitle(activeTabConfig.label)}
                      </h3>
                      <p className="text-slate-500 max-w-sm mx-auto mb-6">
                        {activeTabConfig.description}
                      </p>
                      <div className="px-4 py-2 bg-slate-100 rounded-full text-xs font-semibold text-slate-500">
                        {uiText.adminLayout.readyForTicketImplementation}
                      </div>
                    </div>
                  );
                })()}
              </div>
              
              <footer className="mt-12 text-center text-xs text-slate-400 font-medium">
                {uiText.adminLayout.footer(new Date().getFullYear())}
              </footer>
            </div>
          </main>
        </div>
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
            <div className="p-4 flex items-center justify-between bg-white z-10 sticky top-0 border-b border-slate-100">
              <BrandHeader />
              <button onClick={closeDrawer} className="p-2 -mr-2 text-slate-400 hover:text-slate-700 bg-slate-50 rounded-xl focus:outline-none">
                <X size={20} />
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
