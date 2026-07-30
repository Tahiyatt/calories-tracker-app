import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { status, slowStart } = useAuth();
  const location = useLocation();

  // The loading state matters: without it, a page reload would flash the login
  // screen for a moment while the refresh cookie is still being exchanged.
  if (status === 'loading') {
    return (
      <p className="centered">
        {slowStart
          ? 'Waking the server — the free tier sleeps when idle, so this takes about a minute.'
          : 'Checking your session…'}
      </p>
    );
  }

  if (status !== 'signedIn') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
