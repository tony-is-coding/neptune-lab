import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import { PrimarySidebar } from './components/PrimarySidebar';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Skills } from './pages/Skills';
import { Collaborate } from './pages/Collaborate';
import { CreateAgent } from './pages/CreateAgent';
import { AgentConfig } from './pages/AgentConfig';

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
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Layout />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
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
