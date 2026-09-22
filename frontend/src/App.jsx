import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProjectsPage from './pages/ProjectsPage';
import NotFoundPage from './pages/NotFoundPage';
import './App.css';

const EditorPage = lazy(() => import('./pages/EditorPage'));

const EditorPageFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-slate-600 dark:text-slate-400">
    <div className="h-10 w-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" aria-hidden />
    <p className="text-sm font-medium">Loading editor…</p>
  </div>
);

const RouteLoading = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
  </div>
);

const RootRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <RouteLoading />;
  }

  return <Navigate to={isAuthenticated ? '/projects' : '/login'} replace />;
};

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <RouteLoading />;
  }

  if (!isAuthenticated) {
    const redirectTo = location.pathname !== '/' ? location.pathname + location.search : '/projects';
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectTo)}`} replace state={{ from: location }} />;
  }

  return children;
};

// Public route component
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <RouteLoading />;
  }

  if (isAuthenticated) {
    return <Navigate to="/projects" replace />;
  }

  return children;
};

const App = () => {
  return (
    <ChatProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#111113] dark:text-slate-100">
        <Routes>
          <Route path="/" element={<RootRoute />} />
          {/* Public routes */}
          <Route path="/login" element={
            <PublicRoute>
              <LoginPage />
          </PublicRoute>
          } />
        <Route path="/register" element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        } />
        
        {/* Protected routes */}
        <Route path="/projects" element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }>
          <Route index element={<ProjectsPage />} />
          <Route
            path="new"
            element={
              <Suspense fallback={<EditorPageFallback />}>
                <EditorPage />
              </Suspense>
            }
          />
          <Route
            path=":projectId"
            element={
              <Suspense fallback={<EditorPageFallback />}>
                <EditorPage />
              </Suspense>
            }
          />
        </Route>
        
        {/* 404 route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div> 
    </ChatProvider>
  );
};

export default App;
