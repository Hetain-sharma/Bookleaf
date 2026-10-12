import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../services/api";

function formatTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString("en-IN");
}

export default function AuthorTicketDetails() {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;

    async function loadTicket(isInitialLoad) {
      try {
        const response = await api.get(`/tickets/${ticketId}`);
        if (isCurrent) {
          setTicket(response.data.data);
          setError("");
        }
      } catch (err) {
        if (isCurrent) {
          setError(err.response?.data?.message || "Unable to load this ticket.");
        }
      } finally {
        if (isCurrent) {
          if (isInitialLoad) setLoading(false);
          setRefreshing(false);
        }
      }
    }

    loadTicket(refreshKey === 0);
    const intervalId = window.setInterval(() => loadTicket(false), 15000);

    return () => {
      isCurrent = false;
      window.clearInterval(intervalId);
    };
  }, [ticketId, refreshKey]);

  if (loading) {
    return <p className="page-heading">Loading ticket conversation...</p>;
  }

  if (!ticket) {
    return (
      <div className="page-heading">
        <p className="error-message" role="alert">{error || "Ticket not found."}</p>
        <Link className="secondary-link" to="/author/tickets">Back to support requests</Link>
      </div>
    );
  }

  const replies = [...(ticket.replies || [])].sort(
    (first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime(),
  );

  return (
    <div className="page-heading">
      <p className="eyebrow">Your author workspace / Conversation</p>
      <div className="ticket-title-row">
        <div>
          <h1>{ticket.subject}</h1>
          <p className="muted">#{ticket.ticketId} · {ticket.status}</p>
        </div>
        <Link className="secondary-link" to="/author/tickets">← Back to requests</Link>
      </div>

      <section className="panel conversation-panel">
        <div className="panel-heading-row">
          <div>
            <h2>Ticket conversation</h2>
            <p>Replies from you and the BookLeaf support team appear here.</p>
          </div>
          <button
            className="secondary-button"
            type="button"
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true);
              setRefreshKey((current) => current + 1);
            }}
          >
            {refreshing ? "Refreshing..." : "Refresh conversation"}
          </button>
        </div>

        {error && <p className="error-message" role="alert">{error}</p>}

        <ol className="conversation-list">
          <li className="conversation-message author-message">
            <div className="conversation-message-heading">
              <strong>You</strong>
              <time dateTime={ticket.createdAt}>{formatTimestamp(ticket.createdAt)}</time>
            </div>
            <p>{ticket.description}</p>
          </li>
          {replies.map((reply) => {
            const sender = reply.authorRole === "admin"
              ? "BookLeaf Support"
              : reply.authorId === ticket.authorId
                ? "You"
                : reply.authorName;

            return (
              <li
                className={`conversation-message ${reply.authorRole === "admin" ? "support-message" : "author-message"}`}
                key={reply.id || `${reply.createdAt}-${reply.message}`}
              >
                <div className="conversation-message-heading">
                  <strong>{sender}</strong>
                  <time dateTime={reply.createdAt}>{formatTimestamp(reply.createdAt)}</time>
                </div>
                <p>{reply.message}</p>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
