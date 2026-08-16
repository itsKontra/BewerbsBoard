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

function getDocumentTitle(pathname: string) {
  if (pathname.startsWith('/admin')) return 'BewerbsBoard – Administration';
  if (pathname === '/tv') return 'BewerbsBoard – TV Display';
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
        <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full bg-neutral-900 border border-red-900/60 rounded-xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 bg-red-950/80 border border-red-800 rounded-full flex items-center justify-center mx-auto text-red-500 text-3xl">
              🚫
            </div>
            <h1 className="text-xl font-bold text-red-400">{uiText.auth.forbiddenTitle}</h1>
            <p className="text-sm text-neutral-300">
              {uiText.auth.forbiddenBeforeRole}{' '}
              <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-red-300 font-mono">admin</code>
              {uiText.auth.forbiddenAfterRole}
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleForbiddenLogout}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-red-900/80 hover:bg-red-800 text-red-100 rounded-lg text-sm font-semibold transition-colors border border-red-700/80 shadow-md cursor-pointer"
              >
                <span>🚪</span>
                <span>{uiText.auth.switchAccount}</span>
              </button>
              <a
                href="/"
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-sm font-semibold transition-colors border border-neutral-700"
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

  if (pathname === '/tv') {
    return <TvScoreboard />;
  }

  return <PublicScoreboard />;
}
