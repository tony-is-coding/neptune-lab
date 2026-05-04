import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

interface LayoutProps {
  children: React.ReactNode;
}

const mainNavItems = [
  {
    path: '/',
    label: 'Home',
    exactMatch: true,
    icon: (
      <svg className="w-[12.67px] h-[14.25px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="9 22 9 12 15 12 15 22" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    path: '/agents',
    label: 'Agents',
    icon: (
      <svg className="w-[17.42px] h-[15.04px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 2C6.48 2 2 6 2 11c0 2.76 1.36 5.22 3.48 6.84L4 22l4.92-2.16C10.16 20.28 11.06 20.5 12 20.5c5.52 0 10-4 10-9S17.52 2 12 2z" />
      </svg>
    ),
  },
  {
    path: '/skills',
    label: 'Skills',
    icon: (
      <svg className="w-[15.05px] h-[15.83px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z" />
      </svg>
    ),
  },
  {
    path: '/collaborate',
    label: 'Collaborate',
    icon: (
      <svg className="w-[17.42px] h-[12.67px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const footerNavItems = [
  {
    path: '/alerts',
    label: 'Alerts',
    icon: (
      <svg className="w-[12.67px] h-[15.83px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: (
      <svg className="w-[15.91px] h-[15.83px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();

  const isActive = (path: string, exactMatch?: boolean) => {
    if (exactMatch) {
      // Home exact match + /agent/ sub-routes (chat is a sub-function of Home)
      return location.pathname === path || location.pathname.startsWith('/agent/');
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || 'U';

  return (
    <div className="flex h-screen bg-np-bg">
      {/* Primary Rail — 72px per Figma SideNavBar */}
      <div className="w-[72px] bg-np-surface border-r border-np-border-lighter flex flex-col items-center justify-between py-6 shrink-0">
        {/* Logo */}
        <div className="flex flex-col items-center w-full">
          <Link
            to="/"
            className="flex flex-col items-center justify-center pb-8"
          >
            <span className="text-np-primary font-bold text-[18px] tracking-[-0.45px]">N</span>
          </Link>

          {/* Main Nav Tabs */}
          <div className="flex flex-col gap-[18.8px] items-center w-full px-2">
            {mainNavItems.map((item) => {
              const active = isActive(item.path, item.exactMatch);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex flex-col items-center w-full"
                >
                  <div className={`relative flex flex-col gap-1 items-center justify-center py-[3.5px] rounded-[12px] w-[52px] transition-colors ${
                    active
                      ? 'bg-white shadow-[0px_1px_1px_rgba(0,0,0,0.05)]'
                      : 'hover:bg-white/50'
                  }`}>
                    {active && (
                      <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-np-dark rounded-r-full" />
                    )}
                    <div className={`${active ? 'text-np-primary' : 'text-np-text-muted'}`}>
                      {item.icon}
                    </div>
                    <span className={`font-medium text-[10px] text-center leading-[16px] ${
                      active ? 'text-np-primary' : 'text-np-text-muted'
                    }`}>
                      {item.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Footer Nav Tabs */}
        <div className="flex flex-col gap-[18.75px] items-center w-full px-2">
          {footerNavItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex flex-col items-center w-full"
              >
                <div className={`relative flex flex-col gap-1 items-center justify-center py-[3.5px] rounded-[12px] w-[52px] transition-colors ${
                  active
                    ? 'bg-white shadow-[0px_1px_1px_rgba(0,0,0,0.05)]'
                    : 'hover:bg-white/50'
                }`}>
                  {active && (
                    <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-np-dark rounded-r-full" />
                  )}
                  <div className={`${active ? 'text-np-primary' : 'text-np-text-muted'}`}>
                    {item.icon}
                  </div>
                  <span className={`font-medium text-[10px] text-center leading-[16px] ${
                    active ? 'text-np-primary' : 'text-np-text-muted'
                  }`}>
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}

          {/* User Avatar */}
          <button
            onClick={handleLogout}
            className="w-8 h-8 rounded-full overflow-hidden hover:opacity-80 transition-opacity border border-np-border-lighter"
            title={`${user?.name} (${user?.role}) — Click to logout`}
          >
            <div className="w-full h-full bg-np-accent flex items-center justify-center">
              <span className="text-[10px] font-semibold text-np-primary">{userInitial}</span>
            </div>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
