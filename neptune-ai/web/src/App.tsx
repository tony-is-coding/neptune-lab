import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
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
      <div className="flex-1 ml-[72px] relative border-l border-surface-container-highest">
        <div className="absolute inset-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/skills" element={<Skills />} />
          <Route path="/collaborate/:agentId" element={<Collaborate />} />
          <Route path="/agents/create" element={<CreateAgent />} />
          <Route path="/agents/:id?" element={<AgentConfig />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
