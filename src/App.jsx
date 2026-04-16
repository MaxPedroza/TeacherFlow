import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Finance from "./pages/Finance.jsx";
import Login from './pages/Login.jsx';
import Settings from './pages/Settings.jsx';
import Students from './pages/Students.jsx';
import Schedule from './pages/Schedule.jsx';
import { AuthProvider, useAuthContext } from './context/AuthContext.jsx';
import AppShell from './components/AppShell/AppShell.jsx';
import './styles/main.scss';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuthContext();

  // Evita redirecionamento falso enquanto o Firebase verifica a sessão
  if (loading) return null; 

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell>
      {children}
    </AppShell>
  );
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/agenda" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
      <Route path="/alunos" element={<ProtectedRoute><Students /></ProtectedRoute>} />
      <Route path="/financeiro" element={<ProtectedRoute><Finance /></ProtectedRoute>} />
      <Route path="/configuracoes" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default function App() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('teacherflow-theme') || 'dark';
    document.documentElement.dataset.theme = savedTheme;
  }, []);

  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}