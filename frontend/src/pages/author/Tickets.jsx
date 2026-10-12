import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTickets() {
      try {
        const response = await api.get("/tickets/my-tickets");
        setTickets(response.data.data || []);
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load your tickets.");
      } finally {
        setLoading(false);
      }
    }

    loadTickets();
  }, []);

  return (
    <div className="page-heading">
      <p className="eyebrow">Your author workspace</p>
      <h1>Support requests</h1>
      <p>Track support requests and responses from the BookLeaf team.</p>

      <section className="panel">
        <div className="panel-heading-row">
          <h2>Your inbox</h2>
          <Link className="primary-link" to="/author/tickets/new">
            <span aria-hidden="true">＋</span> New request
          </Link>
        </div>

        {loading && <p>Loading your tickets...</p>}
        {error && <p className="error-message">{error}</p>}

        {!loading && !error && tickets.length === 0 && (
          <div className="empty-state">
            <h3>Your inbox is nice and quiet.</h3>
            <p>When you need a hand, send our team a note and your requests will show up here.</p>
          </div>
        )}

        {!loading && !error && tickets.length > 0 && (
          <div className="ticket-list">
            {tickets.map((ticket) => (
              <article key={ticket.ticketId} className="ticket-card panel">
                <div className="ticket-card-heading">
                  <div>
                    <h3>
                      <Link className="ticket-subject-link" to={`/author/tickets/${ticket.ticketId}`}>
                        {ticket.subject}
                      </Link>
                    </h3>
                    <p className="muted">#{ticket.ticketId}</p>
                  </div>
                  <span className="status-label">{ticket.status}</span>
                </div>

                <p className="ticket-description">{ticket.description}</p>

                <div className="ticket-meta">
                  <span className="muted">Category: {ticket.category}</span>
                  <span className="muted">Priority: {ticket.priority}</span>
                  <span className="muted">
                    {ticket.replies?.length || 0} {(ticket.replies?.length || 0) === 1 ? "reply" : "replies"}
                  </span>
                  <span className="muted">
                    Updated: {new Date(ticket.updatedAt).toLocaleDateString("en-IN")}
                  </span>
                </div>
                <div className="ticket-card-action">
                  <Link className="secondary-link" to={`/author/tickets/${ticket.ticketId}`}>
                    View conversation
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
