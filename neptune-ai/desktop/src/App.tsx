import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Login } from './pages/Login';
import { AgentList } from './pages/AgentList';
import { AgentChat } from './pages/AgentChat';
import { CreateAgent } from './pages/CreateAgent';
import { SkillsHub } from './pages/SkillsHub';
import { Collaborate } from './pages/Collaborate';
import { Alerts } from './pages/Alerts';
import { Settings } from './pages/Settings';
import { Templates } from './pages/admin/Templates';
import { Users } from './pages/admin/Users';
import { Billing } from './pages/admin/Billing';
import { useAuthStore } from './stores/auth';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  console.log('[ProtectedRoute] auth check:', { isAuthenticated, hasToken: !!token, hasUser: !!user, userName: user?.name });

  if (!isAuthenticated) {
    console.warn('[ProtectedRoute] Not authenticated, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login */}
        <Route path="/login" element={<Login />} />

        {/* Home */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AgentList key="home" />
            </ProtectedRoute>
          }
        />

        {/* Create Agent */}
        <Route
          path="/agents/create"
          element={
            <ProtectedRoute>
              <CreateAgent />
            </ProtectedRoute>
          }
        />

        {/* Agent list (alternative) */}
        <Route
          path="/agents"
          element={
            <ProtectedRoute>
              <AgentList key="agents" />
            </ProtectedRoute>
          }
        />

        {/* Agent chat (split-view) */}
        <Route
          path="/agent/:agentId"
          element={
            <ProtectedRoute>
              <ErrorBoundary>
                <AgentChat />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />

        {/* Skills Hub */}
        <Route
          path="/skills"
          element={
            <ProtectedRoute>
              <SkillsHub />
            </ProtectedRoute>
          }
        />

        {/* Collaborate */}
        <Route
          path="/collaborate"
          element={
            <ProtectedRoute>
              <Collaborate />
            </ProtectedRoute>
          }
        />

        {/* Alerts */}
        <Route
          path="/alerts"
          element={
            <ProtectedRoute>
              <Alerts />
            </ProtectedRoute>
          }
        />

        {/* Settings */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* Agent management detail */}
        <Route
          path="/agents/:agentId"
          element={
            <ProtectedRoute>
              <Templates />
            </ProtectedRoute>
          }
        />

        {/* Admin */}
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute>
              <Users />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/billing"
          element={
            <ProtectedRoute>
              <Billing />
            </ProtectedRoute>
          }
        />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
