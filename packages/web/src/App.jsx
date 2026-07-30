import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Nav from './components/Nav.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Today from './pages/Today.jsx';
import Goals from './pages/Goals.jsx';
import Weight from './pages/Weight.jsx';

const Protected = ({ children }) => (
  <ProtectedRoute>
    <>
      <Nav />
      {children}
    </>
  </ProtectedRoute>
);

export default function App() {
  const { isSignedIn } = useAuth();

  return (
    <div className="shell">
      <Routes>
        <Route path="/login" element={isSignedIn ? <Navigate to="/" replace /> : <Login />} />
        <Route
          path="/register"
          element={isSignedIn ? <Navigate to="/" replace /> : <Register />}
        />

        <Route path="/" element={<Protected><Today /></Protected>} />
        <Route path="/goals" element={<Protected><Goals /></Protected>} />
        <Route path="/weight" element={<Protected><Weight /></Protected>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
