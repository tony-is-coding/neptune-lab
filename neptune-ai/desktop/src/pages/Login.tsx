import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuthStore } from '../stores/auth';

export function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        console.log('[Login] Submitting login for:', email);
        const response = await apiClient.login({ email, password });
        console.log('[Login] Response:', JSON.stringify(response, null, 2));
        console.log('[Login] accessToken:', response.accessToken ? `${response.accessToken.slice(0, 20)}...` : 'MISSING');
        console.log('[Login] user:', response.user);
        setAuth(response.user, response.accessToken);
        console.log('[Login] Auth set, navigating to /');
        navigate('/');
      } else {
        console.log('[Login] Submitting register for:', email, name);
        const response = await apiClient.register({
          email,
          password,
          name,
        });
        console.log('[Login] Register response:', JSON.stringify(response, null, 2));
        setAuth(response.user, response.accessToken);
        navigate('/');
      }
    } catch (err) {
      console.error('[Login] Error:', err);
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-np-bg">
      <div className="max-w-[440px] w-full">
        <div className="bg-np-ivory rounded-xl border border-np-border-lighter/30 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] p-10">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <span className="text-np-primary font-bold text-[28px] tracking-[-0.45px]">N</span>
            <span className="text-np-text font-extrabold text-[20px] tracking-tight">Neptune-AI</span>
          </div>

          {/* Heading */}
          <h1 className="text-2xl font-semibold text-np-text text-center mb-2">
            {isLogin ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="text-sm text-np-text-secondary text-center mb-8">
            {isLogin ? 'Sign in to continue to Neptune-AI' : 'Join Neptune-AI platform'}
          </p>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {/* Google Sign In */}
          <button
            type="button"
            className="w-full flex items-center justify-center gap-3 bg-np-ivory border border-np-border rounded-lg px-4 py-3 mb-6 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="text-sm font-medium text-np-text">Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-np-border-light" />
            <span className="text-xs text-np-text-muted">or sign in with email</span>
            <div className="flex-1 h-px bg-np-border-light" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label htmlFor="name" className="block text-sm font-bold text-np-text-secondary mb-2 tracking-wider uppercase text-xs">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                  className="w-full px-4 py-3 bg-np-input-bg border border-np-border rounded-lg text-sm text-np-text placeholder:text-np-text-placeholder focus:outline-none focus:border-np-primary focus:ring-1 focus:ring-np-primary"
                  placeholder="Your full name"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-bold text-np-text-secondary mb-2 tracking-wider uppercase text-xs">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-np-input-bg border border-np-border rounded-lg text-sm text-np-text placeholder:text-np-text-placeholder focus:outline-none focus:border-np-primary focus:ring-1 focus:ring-np-primary"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-bold text-np-text-secondary mb-2 tracking-wider uppercase text-xs">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-np-input-bg border border-np-border rounded-lg text-sm text-np-text placeholder:text-np-text-placeholder focus:outline-none focus:border-np-primary focus:ring-1 focus:ring-np-primary"
                placeholder="Enter your password"
              />
            </div>

            {isLogin && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-np-text-secondary cursor-pointer">
                  <input type="checkbox" className="rounded border-np-border text-np-primary focus:ring-np-primary" />
                  Remember for 30 days
                </label>
                <button type="button" className="text-sm text-np-text-muted hover:text-np-primary transition-colors">
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-np-dark text-white py-3 px-4 rounded-lg font-medium hover:bg-np-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Toggle */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-sm text-np-text-secondary"
            >
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <span className="font-semibold text-np-primary hover:underline">
                {isLogin ? 'Sign up' : 'Sign in'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
