import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { cn } from '../lib/utils';
import { useAuthStore } from '../stores/auth';

export function PrimarySidebar() {
  const location = useLocation();
  const { user, clearAuth } = useAuthStore();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsUserMenuOpen(false);
    }
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isUserMenuOpen]);

  const getUserInitials = () => {
    if (!user?.name) return 'U';
    const names = user.name.trim().split(' ');
    if (names.length >= 2) return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    return user.name.slice(0, 2).toUpperCase();
  };

  const handleLogout = () => {
    clearAuth();
    setIsUserMenuOpen(false);
  };

  const links = [
    { to: '/delivery', icon: 'home', label: '交付台', testId: 'home' },
    { to: '/agents', icon: 'smart_toy', label: '智能体模板', testId: 'agents' },
    { to: '/skills', icon: 'psychology', label: '技能目录', testId: 'skills' },
    { to: '/collaborate', icon: 'groups', label: '运行调试', testId: 'collaborate' },
    { to: '/governance', icon: 'policy', label: '治理台', testId: 'governance' },
    { to: '/close', icon: 'assignment_turned_in', label: '关账工作台', testId: 'close' },
  ];

  return (
    <nav
      data-testid="primary-sidebar"
      className="fixed left-0 top-0 h-full w-[48px] bg-ivory flex flex-col items-center pt-5 pb-4 z-50 shrink-0"
    >
      {/* Logo */}
      <Link to="/" className="mb-8 flex items-center justify-center w-7 h-7 rounded-md" style={{ backgroundColor: '#1a1a1a' }}>
        <span className="font-bold text-[11px] font-serif text-white leading-none">N</span>
      </Link>

      {/* Nav icons */}
      <div className="flex flex-col items-center gap-5 flex-1">
        {links.map(({ to, icon, label, testId }) => {
          const isDelivery = to === '/delivery' && location.pathname === '/';
          const isActive = location.pathname === to || location.pathname.startsWith(`${to}`) || isDelivery;
          const trulyActive = isActive;

          return (
            <Link
              key={to}
              to={to}
              data-testid={`nav-${testId}`}
              title={label}
              className="group relative flex items-center justify-center w-8 h-8"
            >
              <span
                className="material-symbols-outlined text-[20px] transition-colors"
                style={{
                  fontVariationSettings: trulyActive ? "'FILL' 1" : "'FILL' 0",
                  color: trulyActive ? '#141413' : '#87867f',
                }}
              >
                {icon}
              </span>
              {/* Active dot indicator */}
              {trulyActive && (
                <span className="absolute -left-[2px] top-1/2 -translate-y-1/2 w-[3px] h-3 rounded-full bg-charcoal" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Bottom icons */}
      <div className="flex flex-col items-center gap-4 mt-auto">
        <button title="通知" className="flex items-center justify-center w-8 h-8 text-stone hover:text-charcoal transition-colors">
          <span className="material-symbols-outlined text-[20px]">notifications</span>
        </button>
        <button title="设置" className="flex items-center justify-center w-8 h-8 text-stone hover:text-charcoal transition-colors">
          <span className="material-symbols-outlined text-[20px]">settings</span>
        </button>

        {/* User avatar */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-semibold transition-colors"
            style={{
              backgroundColor: isUserMenuOpen ? '#141413' : '#e8e6dc',
              color: isUserMenuOpen ? '#faf9f5' : '#4d4c48',
            }}
            data-testid="user-avatar-button"
          >
            {user ? getUserInitials() : (
              <span className="material-symbols-outlined text-[16px]">account_circle</span>
            )}
          </button>

          {/* User menu popup */}
          {isUserMenuOpen && (
            <div className="absolute bottom-0 left-full ml-3 w-[220px] bg-ivory border border-border-cream rounded-xl shadow-whisper overflow-hidden z-[60]">
              <div className="p-3 border-b border-border-cream">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold" style={{ backgroundColor: '#141413', color: '#faf9f5' }}>
                    {user ? getUserInitials() : 'U'}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[13px] font-semibold text-charcoal truncate">{user?.name || '访客'}</p>
                    <p className="text-[11px] text-stone truncate">{user?.email || '未登录'}</p>
                  </div>
                </div>
              </div>
              <div className="p-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-error hover:bg-surface-container-high transition-colors"
                  data-testid="logout-button"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  <span>退出登录</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
