import React, { useState, useId } from 'react';
import { uiText } from '../../../ui-text';
import { LogIn, Eye, EyeOff, AlertTriangle, Loader2 } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Ambient soft glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-indigo-200/30 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] overflow-hidden">
          <div className="px-8 pt-10 pb-10">
            {/* Logo + title */}
            <div className="flex flex-col items-center mb-8 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30 text-white">
                <span className="text-2xl font-bold tracking-wider select-none">{uiText.common.brandMark}</span>
              </div>
              <div className="text-center">
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">
                  {uiText.common.productName}
                </h1>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  {uiText.auth.adminAccess}
                </p>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div
                role="alert"
                className="mb-6 flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium"
              >
                <AlertTriangle size={18} className="shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Username */}
              <div className="space-y-1.5">
                <label
                  htmlFor={usernameId}
                  className="block text-xs font-bold text-slate-600 uppercase tracking-wider"
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
                    w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5
                    text-sm text-slate-800 placeholder-slate-400
                    outline-none
                    transition-all duration-150
                    focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100
                    disabled:opacity-50 shadow-sm
                  "
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor={passwordId}
                  className="block text-xs font-bold text-slate-600 uppercase tracking-wider"
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
                      w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-11
                      text-sm text-slate-800 placeholder-slate-400
                      outline-none
                      transition-all duration-150
                      focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100
                      disabled:opacity-50 shadow-sm
                    "
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? uiText.auth.hidePassword : uiText.auth.showPassword}
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    className="
                      absolute right-3.5 top-1/2 -translate-y-1/2
                      text-slate-400 hover:text-slate-600
                      transition-colors duration-150 select-none
                    "
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                id="local-auth-submit"
                type="submit"
                disabled={loading || !username || !password}
                className="
                  relative w-full mt-3 flex items-center justify-center gap-2
                  rounded-xl bg-indigo-600
                  px-4 py-3 text-sm font-bold text-white
                  shadow-md shadow-indigo-200
                  transition-all duration-150
                  hover:bg-indigo-700
                  focus:outline-none focus:ring-4 focus:ring-indigo-100
                  disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
                "
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>{uiText.auth.signingIn}</span>
                  </>
                ) : (
                  <>
                    <LogIn size={18} />
                    <span>{uiText.auth.signIn}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-slate-400 font-medium">
          {uiText.auth.footer(new Date().getFullYear())}
        </p>
      </div>
    </div>
  );
};
