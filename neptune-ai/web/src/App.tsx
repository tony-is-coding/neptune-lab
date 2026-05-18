import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './stores/auth';
import { PrimarySidebar } from './components/PrimarySidebar';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Skills } from './pages/Skills';
import { Collaborate } from './pages/Collaborate';
import { CreateAgent } from './pages/CreateAgent';
import { AgentConfig } from './pages/AgentConfig';
import { API_BASE } from './api/client';

function Layout() {
  return (
    <div className="flex w-full h-screen h-[100dvh] text-on-surface overflow-hidden bg-surface-container-low">
      <PrimarySidebar />
      <div className="flex-1 ml-[48px] relative border-l border-surface-container-highest overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}

function ProtectedRoute() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const setAuth = useAuthStore(s => s.setAuth);

  // 开发环境自动登录
  useEffect(() => {
    if (!isAuthenticated) {
      fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@neptune.ai', password: 'admin' }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.user && (data.token || data.accessToken)) {
            setAuth(data.user, data.token || data.accessToken);
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated, setAuth]);

  if (!isAuthenticated) return <div className="flex items-center justify-center h-screen text-stone">自动登录中...</div>;
  return <Layout />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Home />} />
          <Route path="/skills" element={<Skills />} />
          <Route path="/skills/:id" element={<Skills />} />
          {/* 两个路由都指向同一个 Collaborate 组件 */}
          <Route path="/collaborate" element={<Collaborate />} />
          <Route path="/collaborate/:agentId" element={<Collaborate />} />
          <Route path="/agents/create" element={<CreateAgent />} />
          <Route path="/agents/:id?" element={<AgentConfig />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
