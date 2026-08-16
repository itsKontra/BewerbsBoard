import React, { useState, useId } from 'react';
import { uiText } from '../../../ui-text';

export interface LocalLoginProps {
  /** Called after a successful login so the parent can re-render the admin panel. */
  onSuccess?: () => void;
}

export const LocalLogin: React.FC<LocalLoginProps> = ({ onSuccess }) => {
  const usernameId = useId();
  const passwordId = useId();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/local-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        onSuccess?.();
      } else {
        setError(uiText.auth.invalidCredentials);
      }
    } catch {
      setError(uiText.auth.connectionError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-red-900/20 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl shadow-2xl shadow-black/60 backdrop-blur-md overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1 bg-gradient-to-r from-red-700 via-red-500 to-red-700" />

          <div className="px-8 pt-8 pb-10">
            {/* Logo + title */}
            <div className="flex flex-col items-center mb-8 gap-3">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center shadow-lg shadow-red-950/50 border border-red-500/30">
                <span className="text-2xl font-black text-white tracking-wider select-none">{uiText.common.brandMark}</span>
              </div>
              <div className="text-center">
                <h1 className="text-xl font-black text-white tracking-wide uppercase">
                  {uiText.common.productName}
                </h1>
                <p className="text-xs text-neutral-500 mt-1 font-medium">
                  {uiText.auth.adminAccess}
                </p>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-800/60 bg-red-950/50 px-4 py-3 text-sm text-red-300"
              >
                <span className="mt-px shrink-0 text-base">⚠</span>
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Username */}
              <div className="space-y-1.5">
                <label
                  htmlFor={usernameId}
                  className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider"
                >
                  {uiText.auth.username}
                </label>
                <input
                  id={usernameId}
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  placeholder={uiText.auth.usernamePlaceholder}
                  className="
                    w-full rounded-lg border border-neutral-700 bg-neutral-800/70 px-4 py-2.5
                    text-sm text-neutral-100 placeholder-neutral-600
                    outline-none ring-0
                    transition-all duration-150
                    focus:border-red-600 focus:bg-neutral-800 focus:ring-2 focus:ring-red-600/20
                    disabled:opacity-50
                  "
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor={passwordId}
                  className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider"
                >
                  {uiText.auth.password}
                </label>
                <div className="relative">
                  <input
                    id={passwordId}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    placeholder="••••••••"
                    className="
                      w-full rounded-lg border border-neutral-700 bg-neutral-800/70 px-4 py-2.5 pr-11
                      text-sm text-neutral-100 placeholder-neutral-600
                      outline-none ring-0
                      transition-all duration-150
                      focus:border-red-600 focus:bg-neutral-800 focus:ring-2 focus:ring-red-600/20
                      disabled:opacity-50
                    "
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? uiText.auth.hidePassword : uiText.auth.showPassword}
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    className="
                      absolute right-3 top-1/2 -translate-y-1/2
                      text-neutral-500 hover:text-neutral-300
                      transition-colors duration-150 select-none
                    "
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                        <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.091 1.092a4 4 0 0 0-5.557-5.557Z" clipRule="evenodd" />
                        <path d="m10.748 13.93 2.523 2.523a9.987 9.987 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.007 10.007 0 0 1 2.839 6.02L6.07 9.252a4 4 0 0 0 4.678 4.678Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                id="local-auth-submit"
                type="submit"
                disabled={loading || !username || !password}
                className="
                  relative w-full mt-2 flex items-center justify-center gap-2
                  rounded-lg bg-gradient-to-r from-red-700 to-red-600
                  px-4 py-2.5 text-sm font-bold text-white uppercase tracking-wider
                  shadow-lg shadow-red-950/40
                  border border-red-500/30
                  transition-all duration-150
                  hover:from-red-600 hover:to-red-500 hover:shadow-red-900/40
                  focus:outline-none focus:ring-2 focus:ring-red-500/50
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-red-700 disabled:hover:to-red-600
                "
              >
                {loading ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
                    </svg>
                    <span>{uiText.auth.signingIn}</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                      <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clipRule="evenodd" />
                      <path fillRule="evenodd" d="M6 10a.75.75 0 0 1 .75-.75h9.546l-1.048-.943a.75.75 0 1 1 1.004-1.114l2.5 2.25a.75.75 0 0 1 0 1.114l-2.5 2.25a.75.75 0 1 1-1.004-1.114l1.048-.943H6.75A.75.75 0 0 1 6 10Z" clipRule="evenodd" />
                    </svg>
                    <span>{uiText.auth.signIn}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-5 text-center text-xs text-neutral-700">
          {uiText.auth.footer(new Date().getFullYear())}
        </p>
      </div>
    </div>
  );
};
