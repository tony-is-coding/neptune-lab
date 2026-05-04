import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

export function Settings() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const settingsItems = [
    {
      label: 'User Management',
      description: 'Manage team members and roles',
      path: '/admin/users',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      label: 'Billing',
      description: 'Manage subscription and invoices',
      path: '/admin/billing',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="1" y="4" width="22" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      ),
    },
  ];

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-[672px] mx-auto px-6 py-10">
        <h1 className="text-[28px] font-bold text-np-primary tracking-[-0.4px] mb-2">Settings</h1>
        <p className="text-sm text-np-text-secondary mb-8">
          Logged in as {user?.name} ({user?.role})
        </p>

        <div className="flex flex-col gap-3">
          {settingsItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex items-center gap-4 bg-white border border-np-border rounded-xl shadow-[0px_1px_2px_rgba(0,0,0,0.05)] px-5 py-4 cursor-pointer hover:shadow-[0px_4px_10px_rgba(45,41,38,0.08)] transition-shadow text-left w-full"
            >
              <div className="w-12 h-12 rounded-full bg-np-sidebar flex items-center justify-center shrink-0 text-np-text-secondary">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-np-primary">{item.label}</p>
                <p className="text-sm text-np-text-secondary">{item.description}</p>
              </div>
              <svg className="w-5 h-5 text-np-text-muted shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
