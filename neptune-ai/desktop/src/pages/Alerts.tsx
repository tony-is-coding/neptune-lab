export function Alerts() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="bg-np-border-lighter flex items-center justify-center w-16 h-16 rounded-2xl mx-auto mb-4">
          <svg className="w-8 h-8 text-np-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-np-text mb-2">Alerts</h2>
        <p className="text-sm text-np-text-muted">No alerts yet</p>
      </div>
    </div>
  );
}
