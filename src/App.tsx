import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import type { AdminTabId } from './features/admin/components/AdminLayout';
import { authText } from './auth-text';

const PublicScoreboard = lazy(() => import('./features/public/components/PublicScoreboard').then((m) => ({ default: m.PublicScoreboard })));
const TvScoreboard = lazy(() => import('./features/tv/components/TvScoreboard').then((m) => ({ default: m.TvScoreboard })));
const AdminLayout = lazy(() => import('./features/admin/components/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const LocalLogin = lazy(() => import('./features/admin/components/LocalLogin').then((m) => ({ default: m.LocalLogin })));

const ResultsTab = lazy(() => import('./features/admin/components/ResultsTab').then((m) => ({ default: m.ResultsTab })));
const ParticipantsTab = lazy(() => import('./features/admin/components/ParticipantsTab').then((m) => ({ default: m.ParticipantsTab })));
const BroadcastTab = lazy(() => import('./features/admin/components/BroadcastTab').then((m) => ({ default: m.BroadcastTab })));
const SetupTab = lazy(() => import('./features/admin/components/SetupTab').then((m) => ({ default: m.SetupTab })));
const SettingsTab = lazy(() => import('./features/admin/components/SettingsTab').then((m) => ({ default: m.SettingsTab })));
const LogsTab = lazy(() => import('./features/admin/components/LogsTab').then((m) => ({ default: m.LogsTab })));

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
        <Suspense fallback={<div className="min-h-screen bg-slate-900" />}>
          <LocalLogin
            onSuccess={() => {
              // Re-run the probe; it will set adminAuth to 'ok' on success.
              setLoginKey((k) => k + 1);
            }}
          />
        </Suspense>
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
            <h1 className="text-xl font-bold text-slate-800">{authText.forbiddenTitle}</h1>
            <p className="text-sm text-slate-500">
              {authText.forbiddenBeforeRole}{' '}
              <code className="bg-slate-100 px-2 py-0.5 rounded-md text-red-600 font-mono font-semibold border border-slate-200">admin</code>
              {authText.forbiddenAfterRole}
            </p>
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleForbiddenLogout}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                <span>{authText.switchAccount}</span>
              </button>
              <a
                href="/"
                className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
              >
                {authText.backToHome}
              </a>
            </div>
          </div>
        </div>
      );
    }

    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
        <AdminLayout
          key={loginKey}
          onLogout={() => setLoginKey((k) => k + 1)}
          onReady={(navigate) => { navigateTabRef.current = navigate; }}
        >
          {(activeTab: string) => (
            <Suspense fallback={<div className="p-8 text-center text-slate-400">Laden...</div>}>
              {activeTab === 'results' && <ResultsTab />}
              {activeTab === 'participants' && <ParticipantsTab />}
              {activeTab === 'broadcast' && <BroadcastTab onNavigate={(tab) => navigateTabRef.current?.(tab)} />}
              {activeTab === 'setup' && <SetupTab />}
              {activeTab === 'settings' && <SettingsTab />}
              {activeTab === 'logs' && <LogsTab />}
            </Suspense>
          )}
        </AdminLayout>
      </Suspense>
    );
  }

  if (pathname === '/tv') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
        <TvScoreboard />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900" />}>
      <PublicScoreboard />
    </Suspense>
  );
}
