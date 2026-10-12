import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";

export default function Dashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await api.get("/dashboard/author");
        setDashboard(response.data.data);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Unable to load dashboard. Check that the backend is running.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) {
    return <p>Loading your dashboard...</p>;
  }

  if (error) {
    return (
      <section className="panel">
        <h2>Dashboard unavailable</h2>
        <p>{error}</p>
      </section>
    );
  }

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">Your author workspace</p>
        <h1>Your publishing at a glance</h1>
        <p>A little progress, a lot of possibility. Here’s how your books are doing.</p>
      </div>

      <section className="welcome-banner">
        <div className="welcome-copy">
          <p className="eyebrow">Welcome to your studio</p>
          <h2>Your next chapter starts here.</h2>
          <p>Keep an eye on your books and royalties, or reach out to our team whenever you need a hand.</p>
        </div>
        <div className="welcome-actions">
          <Link className="primary-link" to="/author/books/submit">Submit a book</Link>
          <Link className="primary-link" to="/author/books">Explore my books</Link>
          <Link className="secondary-button" to="/author/tickets/new">Get support</Link>
        </div>
      </section>

      <section className="stat-grid">
        <Stat title="Total Books" value={dashboard.totalBooks} />
        <Stat title="Copies Sold" value={dashboard.copiesSold} />
        <Stat
          title="Royalty Earned"
          value={formatCurrency(dashboard.royaltyEarned)}
        />
        <Stat
          title="Royalty Pending"
          value={formatCurrency(dashboard.royaltyPending)}
        />
      </section>

      <section className="panel dashboard-note">
        <p className="eyebrow">A note from your team</p>
        <h2>Good stories grow with good company.</h2>
        <p>Have a question about a title, your royalty statement, or what comes next? We’re just a message away.</p>
        <Link className="secondary-link" to="/author/tickets">Visit your support inbox <span aria-hidden="true">→</span></Link>
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
