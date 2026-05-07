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
    { to: '/', icon: 'home', label: 'Home' },
    { to: '/agents', icon: 'smart_toy', label: 'Agents' },
    { to: '/skills', icon: 'psychology', label: 'Skills' },
    { to: '/collaborate', icon: 'groups', label: 'Collaborate' },
  ];

  return (
    <nav
      data-testid="primary-sidebar"
      className="fixed left-0 top-0 h-full w-[48px] bg-white flex flex-col items-center pt-5 pb-4 z-50 shrink-0"
    >
      {/* Logo */}
      <Link to="/" className="mb-8 flex items-center justify-center w-7 h-7 rounded-md" style={{ backgroundColor: '#1a1a1a' }}>
        <span className="font-bold text-[11px] font-serif text-white leading-none">N</span>
      </Link>

      {/* Nav icons */}
      <div className="flex flex-col items-center gap-5 flex-1">
        {links.map(({ to, icon, label }) => {
          const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(`${to}`));
          const trulyActive = to === '/' ? location.pathname === '/' : isActive;

          return (
            <Link
              key={to}
              to={to}
              data-testid={`nav-${label.toLowerCase()}`}
              title={label}
              className="group relative flex items-center justify-center w-8 h-8"
            >
              <span
                className="material-symbols-outlined text-[20px] transition-colors"
                style={{
                  fontVariationSettings: trulyActive ? "'FILL' 1" : "'FILL' 0",
                  color: trulyActive ? '#1a1a1a' : '#a3a3a3',
                }}
              >
                {icon}
              </span>
              {/* Active dot indicator */}
              {trulyActive && (
                <span className="absolute -left-[2px] top-1/2 -translate-y-1/2 w-[3px] h-3 rounded-full bg-[#1a1a1a]" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Bottom icons */}
      <div className="flex flex-col items-center gap-4 mt-auto">
        <button title="Alerts" className="flex items-center justify-center w-8 h-8 text-[#a3a3a3] hover:text-[#1a1a1a] transition-colors">
          <span className="material-symbols-outlined text-[20px]">notifications</span>
        </button>
        <button title="Settings" className="flex items-center justify-center w-8 h-8 text-[#a3a3a3] hover:text-[#1a1a1a] transition-colors">
          <span className="material-symbols-outlined text-[20px]">settings</span>
        </button>

        {/* User avatar */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-semibold transition-colors"
            style={{
              backgroundColor: isUserMenuOpen ? '#1a1a1a' : '#e5e5e5',
              color: isUserMenuOpen ? '#fff' : '#525252',
            }}
            data-testid="user-avatar-button"
          >
            {user ? getUserInitials() : (
              <span className="material-symbols-outlined text-[16px]">account_circle</span>
            )}
          </button>

          {/* User menu popup */}
          {isUserMenuOpen && (
            <div className="absolute bottom-0 left-full ml-3 w-[220px] bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-[60]">
              <div className="p-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>
                    {user ? getUserInitials() : 'U'}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[13px] font-semibold text-[#1a1a1a] truncate">{user?.name || 'Guest'}</p>
                    <p className="text-[11px] text-[#a3a3a3] truncate">{user?.email || 'Not logged in'}</p>
                  </div>
                </div>
              </div>
              <div className="p-1">
                <Link
                  to="/settings"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-[#1a1a1a] hover:bg-gray-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">settings</span>
                  <span>Settings</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-red-600 hover:bg-red-50 transition-colors"
                  data-testid="logout-button"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
