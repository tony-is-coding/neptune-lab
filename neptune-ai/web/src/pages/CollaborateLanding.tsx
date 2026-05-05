import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRecentCollaborations } from '../api/collaborations';
import type { RecentCollaboration } from '../api/collaborations';

export function CollaborateLanding() {
  const navigate = useNavigate();
  const [collaborations, setCollaborations] = useState<RecentCollaboration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let cancelled = false;

    getRecentCollaborations()
      .then(res => {
        if (cancelled) return;
        setCollaborations(res.data);
      })
      .catch(err => {
        console.error('Failed to load collaborations:', err);
        if (err instanceof Error && err.message.includes('401')) {
          navigate('/login');
          return;
        }
        // If API not available, show empty state (backend might not be ready)
        if (err instanceof Error && err.message.includes('404')) {
          setCollaborations([]);
        } else {
          setError('Failed to load collaborations');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [navigate]);

  const filteredCollaborations = collaborations.filter(c =>
    c.agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.thread.title && c.thread.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-[#4ade80]';
      case 'idle': return 'bg-stone-400';
      case 'completed': return 'bg-[#4ade80]';
      case 'error': return 'bg-red-500';
      default: return 'bg-stone-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running': return 'Working...';
      case 'idle': return 'Idle';
      case 'completed': return 'Completed';
      case 'error': return 'Error';
      default: return status;
    }
  };

  const formatLastActive = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="w-6 h-6 border-2 border-stone/30 border-t-charcoal rounded-full animate-spin" />
        <p className="text-[12px] text-stone mt-3">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface-container-low overflow-hidden">
      {/* Header */}
      <header className="bg-ivory/80 backdrop-blur-md border-b border-surface-container-highest flex items-center px-8 py-4 shrink-0">
        <div className="flex items-center gap-2 text-sm">
          <h1 className="font-bold text-charcoal text-lg">Recent Collaborations</h1>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-4xl mx-auto">
          {/* Search Bar */}
          <div className="mb-8">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-stone">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by agent name or thread title..."
                className="w-full pl-12 pr-4 py-3 bg-white border border-border-cream rounded-lg text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
              />
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <span className="material-symbols-outlined text-red-600">error</span>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Empty State */}
          {filteredCollaborations.length === 0 && !error && (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-surface-container-low flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-[40px] text-stone">forum</span>
              </div>
              <h2 className="font-serif text-[24px] text-charcoal mb-2">No collaborations yet</h2>
              <p className="text-sm text-stone mb-6">
                {searchQuery ? 'No matching collaborations found.' : 'Start collaborating with an agent to see your conversations here.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => navigate('/agents')}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm bg-brand text-white hover:bg-brand/90 transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Browse Agents
                </button>
              )}
            </div>
          )}

          {/* Collaborations List */}
          {filteredCollaborations.length > 0 && (
            <div className="space-y-3">
              {filteredCollaborations.map((collab) => (
                <button
                  key={collab.thread.id}
                  onClick={() => navigate(`/collaborate/${collab.agent.id}`, { state: { threadId: collab.thread.id } })}
                  className="w-full text-left bg-white border border-border-cream rounded-xl p-4 hover:bg-surface-container-low hover:border-border-cream/80 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    {/* Agent Avatar */}
                    <div className="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container shrink-0">
                      <span className="material-symbols-outlined text-[24px]">{collab.agent.icon || 'smart_toy'}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-charcoal truncate">{collab.agent.name}</h3>
                        <span className="text-xs text-stone/60">•</span>
                        <span className={`text-xs font-medium text-stone`}>
                          {collab.thread.title || 'New conversation'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-stone">
                        <span>{formatLastActive(collab.thread.lastActiveAt)}</span>
                        <span className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(collab.thread.status)}`}></span>
                          {getStatusText(collab.thread.status)}
                        </span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <span className="material-symbols-outlined text-stone group-hover:text-charcoal group-hover:translate-x-1 transition-all">
                      chevron_right
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
