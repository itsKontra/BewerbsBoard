import { useState, useEffect, useRef } from 'react';
import { AdminLayout, type AdminTabId } from './features/admin/components/AdminLayout';
import { ParticipantsTab } from './features/admin/components/ParticipantsTab';
import { SetupTab } from './features/admin/components/SetupTab';
import { ResultsTab } from './features/admin/components/ResultsTab';
import { SettingsTab } from './features/admin/components/SettingsTab';
import { BroadcastTab } from './features/admin/components/BroadcastTab';
import { LogsTab } from './features/admin/components/LogsTab';
import { PublicScoreboard } from './features/public/components/PublicScoreboard';
import { TvScoreboard } from './features/tv/components/TvScoreboard';
import { LocalLogin } from './features/admin/components/LocalLogin';
import { uiText } from './ui-text';

type AdminAuthState = 'checking' | 'ok' | 'login-required' | 'forbidden' | 'unauthorized';

function isTvRoute(pathname: string): boolean {
  const clean = pathname.toLowerCase().replace(/\/$/, '');
  return clean === '/tv' || clean === '/1' || clean === '/tv/1' || clean === '/one';
}

function getDocumentTitle(pathname: string) {
  if (pathname.startsWith('/admin')) return 'BewerbsBoard – Administration';
  if (isTvRoute(pathname)) return 'BewerbsBoard – TV Display';
  return 'BewerbsBoard – Live Results';
}

export default function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  // Start as 'checking' so we never render the admin panel before the probe returns.
  const [adminAuth, setAdminAuth] = useState<AdminAuthState>('checking');
  const [loginKey, setLoginKey] = useState(0);
  // Ref that BroadcastTab can call to programmatically switch tabs (Issue 05)
  const navigateTabRef = useRef<((tab: AdminTabId) => void) | null>(null);

  useEffect(() => {
    document.title = getDocumentTitle(pathname);
  }, [pathname]);

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Probe /api/admin/me to detect whether local-auth is required or proxy-auth is authorized.
  // Runs whenever the admin subtree is entered or after a successful login.
  useEffect(() => {
    if (!pathname.startsWith('/admin')) return;

    setAdminAuth('checking');

    fetch('/api/admin/me').then((res) => {
      if (res.status === 401 && res.headers.get('X-Auth-Mode') === 'local') {
        setAdminAuth('login-required');
      } else if (res.status === 403) {
        setAdminAuth('forbidden');
      } else if (res.status === 401) {
        setAdminAuth('unauthorized');
      } else {
        setAdminAuth('ok');
      }
    }).catch(() => {
      // Network error — let the admin layout handle it; don't block forever.
      setAdminAuth('ok');
    });
  }, [pathname, loginKey]);

  if (pathname.startsWith('/admin')) {
    if (adminAuth === 'checking') {
      // Don't render the panel until we know auth status.
      return null;
    }

    if (adminAuth === 'login-required') {
      return (
        <LocalLogin
          onSuccess={() => {
            // Re-run the probe; it will set adminAuth to 'ok' on success.
            setLoginKey((k) => k + 1);
          }}
        />
      );
    }

    if (adminAuth === 'forbidden' || adminAuth === 'unauthorized') {
      const handleForbiddenLogout = async () => {
        try {
          await fetch('/local-auth/logout', { method: 'POST' });
        } catch {
          // Ignore
        }
        window.location.href = '/oauth2/sign_out?rd=/admin';
      };

      return (
        <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-slate-100 rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.06)] text-center space-y-5">
            <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center mx-auto text-red-600 text-2xl font-bold">
              🚫
            </div>
            <h1 className="text-xl font-bold text-slate-800">{uiText.auth.forbiddenTitle}</h1>
            <p className="text-sm text-slate-500">
              {uiText.auth.forbiddenBeforeRole}{' '}
              <code className="bg-slate-100 px-2 py-0.5 rounded-md text-red-600 font-mono font-semibold border border-slate-200">admin</code>
              {uiText.auth.forbiddenAfterRole}
            </p>
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleForbiddenLogout}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                <span>{uiText.auth.switchAccount}</span>
              </button>
              <a
                href="/"
                className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
              >
                {uiText.auth.backToHome}
              </a>
            </div>
          </div>
        </div>
      );
    }

    return (
      <AdminLayout
        key={loginKey}
        onLogout={() => setLoginKey((k) => k + 1)}
        onReady={(navigate) => { navigateTabRef.current = navigate; }}
      >
        {(activeTab: string) => {
          if (activeTab === 'results') {
            return <ResultsTab />;
          }
          if (activeTab === 'participants') {
            return <ParticipantsTab />;
          }
          if (activeTab === 'broadcast') {
            return <BroadcastTab onNavigate={(tab) => navigateTabRef.current?.(tab)} />;
          }
          if (activeTab === 'setup') {
            return <SetupTab />;
          }
          if (activeTab === 'settings') {
            return <SettingsTab />;
          }
          if (activeTab === 'logs') {
            return <LogsTab />;
          }
          return null;
        }}
      </AdminLayout>
    );
  }

  if (isTvRoute(pathname)) {
    return <TvScoreboard />;
  }

  return <PublicScoreboard />;
}
