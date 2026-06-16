import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import ScorerPanel from './pages/ScorerPanel';
import MatchCenter from './pages/MatchCenter';
import OverlayView from './pages/OverlayView';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/scorer/:id" element={<ScorerPanel />} />
        <Route path="/live/:id" element={<MatchCenter />} />
        <Route path="/overlay/:id" element={<OverlayView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
