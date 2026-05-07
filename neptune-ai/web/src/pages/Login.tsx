import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuthStore } from "../stores/auth";
import { login, register } from "../api/auth";

export function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already authenticated — use <Navigate> to avoid setState during render
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = mode === 'login'
        ? await login(email, password)
        : await register(name, email, password);

      setAuth(result.user, result.token);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-parchment min-h-screen flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-[440px] bg-ivory rounded-lg p-10 shadow-whisper border border-surface-container flex flex-col items-center">

        <div className="flex items-center gap-3 mb-10">
          <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>water</span>
          <span className="text-2xl font-bold text-charcoal">Neptune-AI</span>
        </div>

        <div className="text-center mb-10">
          <h1 className="font-serif text-[32px] leading-tight font-medium text-charcoal mb-2">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="text-[15px] text-stone">
            {mode === 'login' ? 'Please enter your details to sign in.' : 'Enter your details to get started.'}
          </p>
        </div>

        {error && (
          <div className="w-full mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">
            {error}
          </div>
        )}

        <div className="w-full space-y-6">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-charcoal" htmlFor="name">Name</label>
                <input
                  className="w-full bg-white border border-border-cream rounded-lg px-3 py-2.5 text-[15px] text-charcoal focus:outline-none focus:border-charcoal focus:ring-1 focus:ring-charcoal transition-colors placeholder:text-gray-400"
                  id="name"
                  placeholder="Your name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-charcoal" htmlFor="email">Email</label>
              <input
                className="w-full bg-white border border-border-cream rounded-lg px-3 py-2.5 text-[15px] text-charcoal focus:outline-none focus:border-charcoal focus:ring-1 focus:ring-charcoal transition-colors placeholder:text-gray-400"
                id="email"
                placeholder="Enter your email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-charcoal" htmlFor="password">Password</label>
              <input
                className="w-full bg-white border border-border-cream rounded-lg px-3 py-2.5 text-[15px] text-charcoal focus:outline-none focus:border-charcoal focus:ring-1 focus:ring-charcoal transition-colors placeholder:text-gray-400"
                id="password"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              className="w-full bg-charcoal text-ivory py-2.5 px-6 rounded-lg text-[14px] font-semibold hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-charcoal disabled:opacity-50 disabled:cursor-not-allowed"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>

        <div className="mt-10 text-center">
          <span className="text-[14px] text-stone">
            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
          </span>
          <button
            className="text-[14px] font-medium text-charcoal hover:text-brand transition-colors inline-block"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
