import { Link, useLocation } from 'react-router-dom';
import { cn } from '../lib/utils';

export function PrimarySidebar() {
  const location = useLocation();

  const links = [
    { to: '/', icon: 'home', label: 'Home' },
    { to: '/agents', icon: 'smart_toy', label: 'Agents' },
    { to: '/skills', icon: 'psychology', label: 'Skills' },
    { to: '/collaborate', icon: 'groups', label: 'Collaborate' },
  ];

  return (
    <nav className="fixed left-0 top-0 h-full w-[72px] border-r border-surface-container-highest bg-sidebar flex flex-col items-center py-6 z-50 shrink-0">
      <div className="mb-8 flex items-center justify-center w-12 h-12 bg-primary rounded-xl text-on-primary shadow-sm" style={{ backgroundColor: '#141413' }}>
        <span className="font-bold text-2xl font-serif">N</span>
      </div>

      <div className="flex flex-col gap-2 w-full px-2 flex-1">
        {links.map(({ to, icon, label }) => {
          const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(`${to}`));
          const trulyActive = to === '/' ? location.pathname === '/' : isActive;

          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "w-full aspect-square flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-300 group relative",
                trulyActive 
                  ? "bg-surface-lowest text-on-surface shadow-sm after:content-[''] after:absolute after:left-0 after:top-1/4 after:h-1/2 after:w-1 after:bg-primary after:rounded-r-full" 
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface scale-95 active:scale-90"
              )}
            >
              <span className="material-symbols-outlined text-[24px] group-hover:scale-110 transition-transform" style={{ fontVariationSettings: trulyActive ? "'FILL' 1" : "'FILL' 0" }}>
                {icon}
              </span>
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 w-full px-2 mt-auto">
        <button className="w-full aspect-square flex flex-col items-center justify-center gap-1 text-on-surface-variant scale-95 active:scale-90 transition-transform hover:bg-surface-container-high hover:text-on-surface rounded-xl">
          <span className="material-symbols-outlined text-[24px]">notifications</span>
          <span className="text-[10px] font-medium leading-none">Alerts</span>
        </button>
        <button className="w-full aspect-square flex flex-col items-center justify-center gap-1 text-on-surface-variant scale-95 active:scale-90 transition-transform hover:bg-surface-container-high hover:text-on-surface rounded-xl">
          <span className="material-symbols-outlined text-[24px]">settings</span>
          <span className="text-[10px] font-medium leading-none">Settings</span>
        </button>
      </div>
    </nav>
  );
}
