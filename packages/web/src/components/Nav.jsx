import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Nav() {
  const { user, logout } = useAuth();

  return (
    <nav className="nav">
      <div className="nav-links">
        <NavLink to="/">Dashboard</NavLink>
        <NavLink to="/today">Today</NavLink>
        <NavLink to="/goals">Goals</NavLink>
        <NavLink to="/weight">Weight</NavLink>
      </div>
      <div className="nav-user">
        <span>{user?.profile?.displayName || user?.email}</span>
        <button className="link-button" onClick={logout}>Sign out</button>
      </div>
    </nav>
  );
}
