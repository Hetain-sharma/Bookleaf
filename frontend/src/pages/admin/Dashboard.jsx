import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStats() {
      try {
        const response = await api.get("/tickets/stats");
        setStats(response.data.data);
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load support metrics.");
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">Your operations workspace</p>
        <h1>Support overview</h1>
        <p>See what needs attention and help every author keep moving forward.</p>
      </div>

      <section className="welcome-banner">
        <div className="welcome-copy">
          <p className="eyebrow">The support desk</p>
          <h2>Small details make a big difference.</h2>
          <p>Stay close to the queue, follow up with authors, and make each reply feel personal.</p>
        </div>
        <div className="welcome-actions">
          <Link className="primary-link" to="/admin/tickets">View ticket queue</Link>
          <Link className="secondary-button" to="/admin/book-submissions">Review book submissions</Link>
        </div>
      </section>

      {loading && <p>Loading support metrics...</p>}
      {error && <p className="error-message">{error}</p>}

      {!loading && !error && stats && (
        <section className="stat-grid">
          <Stat title="Open Tickets" value={stats.open} />
          <Stat title="In Progress" value={stats.inProgress} />
          <Stat title="Waiting for author" value={stats.waiting} />
          <Stat title="Resolved" value={stats.resolved} />
          <Stat title="Unassigned" value={stats.unassigned} />
        </section>
      )}

      <section className="panel dashboard-note">
        <p className="eyebrow">A little reminder</p>
        <h2>Every ticket is a person behind a page.</h2>
        <p>Review new requests, share clear next steps, and keep authors in the loop as their questions progress.</p>
        <Link className="primary-link" to="/admin/tickets">
          Open support queue
        </Link>
        <Link className="secondary-link" to="/admin/book-submissions">
          Review book submissions <span aria-hidden="true">→</span>
        </Link>
      </section>
    </>
  );
}

function Stat({ title, value }) {
  return (
    <article className="stat-card">
      <p>{title}</p>
      <h2>{value}</h2>
    </article>
  );
}
