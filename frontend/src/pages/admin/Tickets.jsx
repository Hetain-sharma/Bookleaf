import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "Open", label: "Open" },
  { value: "In progress", label: "In Progress" },
  { value: "Waiting for author", label: "Waiting for author" },
  { value: "Resolved", label: "Resolved" },
  { value: "Closed", label: "Closed" },
];

export default function AdminTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    async function loadTickets() {
      try {
        setLoading(true);
        const response = await api.get("/tickets", {
          params: {
            search: search || undefined,
            status: status === "all" ? undefined : status,
          },
        });
        setTickets(response.data.data || []);
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load the ticket queue.");
      } finally {
        setLoading(false);
      }
    }

    loadTickets();
  }, [search, status]);

  return (
    <div className="page-heading">
      <p className="eyebrow">Your operations workspace</p>
      <h1>Support queue</h1>
      <p>Review and manage incoming requests across all authors.</p>

      <section className="panel">
        <div className="filter-row">
          <input
            type="search"
            aria-label="Search support tickets"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tickets..."
          />
          <select aria-label="Filter tickets by status" value={status} onChange={(event) => setStatus(event.target.value)}>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {loading && <p>Loading tickets...</p>}
        {error && <p className="error-message">{error}</p>}

        {!loading && !error && tickets.length === 0 && (
          <div className="empty-state">
            <h3>The queue is clear.</h3>
            <p>No requests match those filters. Try a different search or status.</p>
          </div>
        )}

        {!loading && !error && tickets.length > 0 && (
          <div className="ticket-list">
            {tickets.map((ticket) => (
              <article key={ticket.ticketId} className="ticket-card panel">
                <div className="ticket-card-heading">
                  <div>
                    <h3>{ticket.subject}</h3>
                    <p className="muted">
                      #{ticket.ticketId} · {ticket.authorName || "Unknown author"}
                    </p>
                  </div>
                  <span className="status-label">{ticket.status}</span>
                </div>

                <p className="ticket-description">{ticket.description}</p>

                <div className="ticket-meta">
                  <span className="muted">Category: {ticket.category}</span>
                  <span className="muted">Priority: {ticket.priority}</span>
                  <span className="muted">
                    Updated: {new Date(ticket.updatedAt).toLocaleDateString("en-IN")}
                  </span>
                </div>

                <div className="ticket-card-action">
                  <Link className="primary-link" to={`/admin/tickets/${ticket.ticketId}`}>
                    Review Ticket
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
