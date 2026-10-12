import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../services/api";

function createReplyRequestId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function AdminTicketDetails() {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [draft, setDraft] = useState("");
  const [replyText, setReplyText] = useState("");
  const [status, setStatus] = useState("Open");
  const [priority, setPriority] = useState("Medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [assignedAgentName, setAssignedAgentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [draftLoading, setDraftLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const sendingRef = useRef(false);
  const replyRequestIdRef = useRef(null);

  useEffect(() => {
    async function loadTicket() {
      try {
        setLoading(true);
        const response = await api.get(`/tickets/${ticketId}`);
        const nextTicket = response.data.data;
        setTicket(nextTicket);
        setDraft(nextTicket?.aiDraft?.message || "");
        setStatus(nextTicket?.status || "Open");
        setPriority(nextTicket?.priority || "Medium");
        setAssignedTo(nextTicket?.assignedTo || "");
        setAssignedAgentName(nextTicket?.assignedAgentName || "");
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load this ticket.");
      } finally {
        setLoading(false);
      }
    }

    loadTicket();
  }, [ticketId]);

  async function generateDraft() {
    try {
      setDraftLoading(true);
      setError("");
      const response = await api.post(`/ai/${ticketId}/ai-draft`);
      setDraft(response.data.data.draft || "");
      setReplyText(response.data.data.draft || "");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to generate an AI draft.");
    } finally {
      setDraftLoading(false);
    }
  }

  async function handleStatusUpdate() {
    try {
      setError("");
      await api.patch(`/tickets/${ticketId}/status`, { status });
      setSuccess("Ticket status updated.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update the status.");
    }
  }

  async function handlePriorityUpdate() {
    try {
      setError("");
      await api.patch(`/tickets/${ticketId}/priority`, { priority });
      setSuccess("Ticket priority updated.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update the priority.");
    }
  }

  async function handleAssignmentUpdate() {
    try {
      setError("");
      await api.patch(`/tickets/${ticketId}/assign`, {
        assignedTo: assignedTo || "SUPPORT-01",
        assignedAgentName: assignedAgentName || "Support team",
      });
      setSuccess("Ticket assignment updated.");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update the assignment.");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const finalReply = replyText.trim();

    if (sendingRef.current) return;

    if (!finalReply) {
      setError("Add a final response before sending the reply.");
      return;
    }

    try {
      sendingRef.current = true;
      setSending(true);
      setError("");
      setSuccess("");
      const clientMessageId = replyRequestIdRef.current || createReplyRequestId();
      replyRequestIdRef.current = clientMessageId;
      const response = await api.post(
        `/tickets/${ticketId}/replies`,
        { message: finalReply },
        { headers: { "Idempotency-Key": clientMessageId } },
      );
      setTicket((current) => current && ({
        ...current,
        replies: (current.replies || []).some(
          (reply) => reply.id && reply.id === response.data.data.id,
        )
          ? current.replies
          : [...(current.replies || []), response.data.data],
        aiDraft: null,
      }));
      setSuccess("Reply sent successfully.");
      setReplyText("");
      setDraft("");
      replyRequestIdRef.current = null;
    } catch (err) {
      setError(err.response?.data?.message || "Unable to send the reply.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  if (loading) {
    return <p>Loading ticket details...</p>;
  }

  if (error && !ticket) {
    return <p className="error-message page-heading" role="alert">{error}</p>;
  }

  return (
    <div className="page-heading">
      <p className="eyebrow">Support queue / Ticket</p>
      <div className="ticket-title-row">
        <h1>Ticket details</h1>
        <Link className="secondary-link" to="/admin/tickets">← Back to queue</Link>
      </div>
      <p>Review the author query and prepare a support response.</p>

      <div className="ticket-grid">
        <section className="panel">
          <p className="eyebrow">Author request</p>
          <h2>{ticket?.subject}</h2>
          <div className="ticket-facts">
            <p><strong>Ticket ID</strong><span>#{ticket?.ticketId}</span></p>
            <p><strong>Author</strong><span>{ticket?.authorName}</span></p>
            <p><strong>Email</strong><span>{ticket?.authorEmail}</span></p>
            <p><strong>Category</strong><span>{ticket?.category}</span></p>
            <p><strong>Current status</strong><span className="status-label">{ticket?.status}</span></p>
            <p><strong>Priority</strong><span className="status-label priority-label">{ticket?.priority}</span></p>
          </div>
          <div className="ticket-description-block">
            <span>Description</span>
            <p>{ticket?.description}</p>
          </div>

          <div className="ticket-control">
            <h3>Update status</h3>
            <label htmlFor="status-select">Status</label>
            <select id="status-select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="Open">Open</option>
              <option value="In progress">In progress</option>
              <option value="Waiting for author">Waiting for author</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
            <button type="button" className="secondary-button" onClick={handleStatusUpdate}>Save status</button>
          </div>

          <div className="ticket-control">
            <h3>Set priority</h3>
            <label htmlFor="priority-select">Priority</label>
            <select id="priority-select" value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
            <button type="button" className="secondary-button" onClick={handlePriorityUpdate}>Save priority</button>
          </div>

          <div className="ticket-control">
            <h3>Assignment</h3>
            <label htmlFor="assigned-to">Assigned support ID</label>
            <input
              id="assigned-to"
              value={assignedTo}
              onChange={(event) => setAssignedTo(event.target.value)}
              placeholder="SUPPORT-01"
            />
            <label htmlFor="assigned-name">Assigned support name</label>
            <input
              id="assigned-name"
              value={assignedAgentName}
              onChange={(event) => setAssignedAgentName(event.target.value)}
              placeholder="Support team"
            />
            <button type="button" className="secondary-button" onClick={handleAssignmentUpdate}>Save assignment</button>
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">Response workspace</p>
          <h2>Reply to the author</h2>
          <p>Review the generated draft before sending any response.</p>

          <button className="primary-button" onClick={generateDraft} disabled={draftLoading}>
            {draftLoading ? "Generating..." : "Generate AI Draft"}
          </button>

          <label htmlFor="draft" className="field-label">AI draft</label>
          <textarea
            id="draft"
            rows="6"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="AI-generated response will appear here..."
          />

          <form className="reply-form" onSubmit={handleSubmit}>
            <label htmlFor="reply">Final reply</label>
            <textarea
              id="reply"
              rows="6"
              value={replyText}
              onChange={(event) => setReplyText(event.target.value)}
              placeholder="Review and send the final author response..."
            />

            {error && <p className="error-message" role="alert">{error}</p>}
            {success && <p className="success-message" role="status">{success}</p>}

            <button type="submit" className="primary-button" disabled={sending}>
              {sending ? "Sending..." : "Send Reply"}
            </button>
          </form>

          <div className="reply-history" aria-live="polite">
            <h3>Sent replies</h3>
            {(ticket?.replies || []).map((reply) => (
              <article className="conversation-message" key={reply.id || `${reply.createdAt}-${reply.message}`}>
                <div className="conversation-message-heading">
                  <strong>{reply.authorRole === "admin" ? "You · BookLeaf Support" : reply.authorName}</strong>
                  <time dateTime={reply.createdAt}>
                    {new Date(reply.createdAt).toLocaleString("en-IN")}
                  </time>
                </div>
                <p>{reply.message}</p>
              </article>
            ))}
            {!ticket?.replies?.length && <p>No replies have been sent yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
