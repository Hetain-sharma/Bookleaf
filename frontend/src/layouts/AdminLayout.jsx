import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { getStoredUser, setAuthToken } from "../services/api";

export default function AdminLayout() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const initials = (user?.name || "Admin")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = () => {
    setAuthToken(null, null);
    navigate("/login", { replace: true });
  };

  return (
    <div className="portal">
      <aside className="portal-sidebar admin-sidebar">
        <div className="portal-brand-row">
          <span className="portal-brand-mark" aria-hidden="true">B</span>
          <div>
            <h2 className="portal-brand">BookLeaf</h2>
            <p className="portal-subtitle">Support team</p>
          </div>
        </div>

        <nav className="portal-nav">
          <p className="portal-nav-label">Operations</p>
          <NavLink to="/admin/dashboard"><span className="nav-icon" aria-hidden="true">⌂</span>Overview</NavLink>
          <NavLink to="/admin/tickets"><span className="nav-icon" aria-hidden="true">☷</span>Ticket queue</NavLink>
          <NavLink to="/admin/book-submissions"><span className="nav-icon" aria-hidden="true">▤</span>Book submissions</NavLink>
        </nav>

        <div className="sidebar-note">
          <p>Thoughtful support makes every story better.</p>
          <span>Author care, one reply at a time.</span>
        </div>

        <div className="portal-user">
          <span className="user-avatar">{initials}</span>
          <div className="portal-user-copy">
            <strong>{user?.name || "Admin"}</strong>
            <span>{user?.email || "Support team"}</span>
          </div>
          <button type="button" onClick={handleLogout} aria-label="Log out">Log out</button>
        </div>
      </aside>

      <main className="portal-main">
        <header className="portal-header">
          <span>BookLeaf <span aria-hidden="true">/</span> Support operations</span>
          <span className="environment-label">Team workspace</span>
        </header>

        <Outlet />
      </main>
    </div>
  );
}
