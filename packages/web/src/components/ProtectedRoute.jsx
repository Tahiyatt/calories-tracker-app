import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { status } = useAuth();
  const location = useLocation();

  // The loading state matters: without it, a page reload would flash the login
  // screen for a moment while the refresh cookie is still being exchanged.
  if (status === 'loading') return <p className="centered">Checking your session…</p>;

  if (status !== 'signedIn') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
