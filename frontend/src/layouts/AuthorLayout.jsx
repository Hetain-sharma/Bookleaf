import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { getStoredUser, setAuthToken } from "../services/api";

export default function AuthorLayout() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const initials = (user?.name || "Author")
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
      <aside className="portal-sidebar">
        <div className="portal-brand-row">
          <span className="portal-brand-mark" aria-hidden="true">B</span>
          <div>
            <h2 className="portal-brand">BookLeaf</h2>
            <p className="portal-subtitle">Author studio</p>
          </div>
        </div>

        <nav className="portal-nav">
          <p className="portal-nav-label">Workspace</p>
          <NavLink to="/author/dashboard"><span className="nav-icon" aria-hidden="true">⌂</span>Overview</NavLink>
          <NavLink to="/author/books"><span className="nav-icon" aria-hidden="true">▤</span>My books</NavLink>
          <NavLink to="/author/tickets"><span className="nav-icon" aria-hidden="true">◷</span>Support requests</NavLink>
          <NavLink to="/author/tickets/new"><span className="nav-icon" aria-hidden="true">＋</span>Get support</NavLink>
        </nav>

        <div className="sidebar-note">
          <p>Every great story deserves a little support.</p>
          <span>We’re here for your next chapter.</span>
        </div>

        <div className="portal-user">
          <span className="user-avatar">{initials}</span>
          <div className="portal-user-copy">
            <strong>{user?.name || "Author"}</strong>
            <span>{user?.email || "Author account"}</span>
          </div>
          <button type="button" onClick={handleLogout} aria-label="Log out">Log out</button>
        </div>
      </aside>

      <main className="portal-main">
        <header className="portal-header">
          <span>BookLeaf <span aria-hidden="true">/</span> Author studio</span>
          <span className="environment-label">Your workspace</span>
        </header>

        <Outlet />
      </main>
    </div>
  );
}
