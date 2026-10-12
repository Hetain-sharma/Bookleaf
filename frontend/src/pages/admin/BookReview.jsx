import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../services/api";
import PrivateBookFile from "../../components/PrivateBookFile";

function showDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString("en-IN");
}

export default function AdminBookReview() {
  const { bookId } = useParams();
  const [book, setBook] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [publicationDate, setPublicationDate] = useState(new Date().toISOString().slice(0, 10));
  const [mrp, setMrp] = useState("");
  const [isbn, setIsbn] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    api.get(`/books/${bookId}`)
      .then((response) => {
        if (!active) return;
        const details = response.data.data;
        setBook(details);
        setFeedback(details.adminFeedback || "");
        setPublicationDate(details.publicationDate
          ? new Date(details.publicationDate).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10));
        setMrp(details.publicationDetails?.mrp ?? "");
        setIsbn(details.isbn || "");
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.message || "Unable to load this submission.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [bookId]);

  async function review(action) {
    setError("");
    setSuccess("");
    if (action !== "Approved" && !feedback.trim()) {
      setError("Add an explanation before requesting changes or rejecting this submission.");
      return;
    }
    const verb = action === "Approved" ? "approve" : action === "Rejected" ? "reject" : "request changes to";
    if (!window.confirm(`Are you sure you want to ${verb} this book?`)) return;

    try {
      setSaving(true);
      const response = await api.patch(`/books/${bookId}/review`, { action, feedback });
      setBook(response.data.data);
      setSuccess(response.data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to record this review.");
    } finally {
      setSaving(false);
    }
  }

  async function startReview() {
    setError("");
    setSuccess("");
    try {
      setSaving(true);
      const response = await api.patch(`/books/${bookId}/start-review`);
      setBook(response.data.data);
      setSuccess(response.data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to start this review.");
    } finally {
      setSaving(false);
    }
  }

  async function savePublicationDetails(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      setSaving(true);
      const response = await api.patch(`/books/${bookId}/publication-details`, {
        publicationDate,
        mrp,
        isbn,
      });
      setBook(response.data.data);
      setSuccess(response.data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to save publication details.");
    } finally {
      setSaving(false);
    }
  }

  async function publishBook() {
    if (!window.confirm("Publish this approved book in BookLeaf? This does not publish it to external marketplaces.")) return;
    setError("");
    setSuccess("");
    try {
      setSaving(true);
      const response = await api.post(`/books/${bookId}/publish`);
      setBook(response.data.data);
      setSuccess(response.data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to publish this book.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="page-heading">Loading book submission...</p>;
  if (!book) {
    return (
      <div className="page-heading">
        <p className="error-message" role="alert">{error || "Submission not found."}</p>
        <Link className="secondary-link" to="/admin/book-submissions">Back to submissions</Link>
      </div>
    );
  }

  const canReview = ["Submitted", "Under Review"].includes(book.submissionStatus);
  return (
    <div className="page-heading">
      <p className="eyebrow">Your operations workspace / Book review</p>
      <div className="ticket-title-row">
        <div>
          <h1>{book.title}</h1>
          <p className="muted">#{book.bookId} · {book.authorName} · {book.authorId}</p>
        </div>
        <Link className="secondary-link" to="/admin/book-submissions">← Back to submissions</Link>
      </div>
      <p><span className="status-label">{book.submissionStatus}</span></p>
      {error && <p className="error-message" role="alert">{error}</p>}
      {success && <p className="success-message" role="status">{success}</p>}

      <div className="book-review-grid">
        <section className="panel">
          <h2>Submission details</h2>
          {book.subtitle && <p><strong>Subtitle:</strong> {book.subtitle}</p>}
          <p><strong>Author:</strong> {book.authorName}</p>
          <p><strong>Genre:</strong> {book.genre}</p>
          <p><strong>Language:</strong> {book.language}</p>
          {book.isbn && <p><strong>ISBN:</strong> {book.isbn}</p>}
          <p><strong>Submitted:</strong> {showDate(book.submissionDate)}</p>
          <p><strong>Last updated:</strong> {showDate(book.updatedAt)}</p>
          <div className="book-synopsis">
            <h3>Synopsis</h3>
            <p>{book.synopsis}</p>
          </div>
          <h3>Cover image</h3>
          <PrivateBookFile bookId={bookId} fileType="cover" file={book.coverImage} />
          <h3>Private manuscript</h3>
          <PrivateBookFile bookId={bookId} fileType="manuscript" file={book.manuscript} />
        </section>

        <section className="panel">
          <h2>Review decision</h2>
          {canReview ? (
            <>
              {book.submissionStatus === "Submitted" && (
                <button className="secondary-button" type="button" disabled={saving} onClick={startReview}>
                  Start review
                </button>
              )}
              <label htmlFor="review-feedback">Feedback <span className="muted">(required for rejection or change requests)</span></label>
              <textarea
                id="review-feedback"
                rows="6"
                maxLength="4000"
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
              />
              <div className="review-actions">
                <button className="primary-button" type="button" disabled={saving} onClick={() => review("Approved")}>Approve</button>
                <button className="secondary-button" type="button" disabled={saving} onClick={() => review("Changes Requested")}>Request changes</button>
                <button className="danger-button" type="button" disabled={saving} onClick={() => review("Rejected")}>Reject</button>
              </div>
            </>
          ) : (
            <>
              <p><strong>Current feedback:</strong> {book.adminFeedback || "No additional feedback."}</p>
              <p>Review decisions cannot be changed from this status.</p>
            </>
          )}

          {["Approved", "Publishing"].includes(book.submissionStatus) && (
            <form className="publication-form" onSubmit={savePublicationDetails}>
              <h3>Publication details</h3>
              <p>An approved title is not published until you save these details and explicitly publish it. You can update the details before publishing.</p>
              <label htmlFor="publication-date">Publication date</label>
              <input id="publication-date" type="date" required value={publicationDate} onChange={(event) => setPublicationDate(event.target.value)} />
              <label htmlFor="publication-price">Book price (MRP)</label>
              <input id="publication-price" type="number" min="0.01" step="0.01" required value={mrp} onChange={(event) => setMrp(event.target.value)} />
              <label htmlFor="publication-isbn">ISBN <span className="muted">(optional)</span></label>
              <input id="publication-isbn" value={isbn} onChange={(event) => setIsbn(event.target.value)} />
              <button className="secondary-button" type="submit" disabled={saving}>Save publication details</button>
            </form>
          )}

          {book.submissionStatus === "Publishing" && (
            <div className="publication-form">
              <h3>Ready to publish</h3>
              <p>Publication date: {showDate(book.publicationDate)}</p>
              <p>MRP: ₹{book.publicationDetails?.mrp}</p>
              <button className="primary-button" type="button" disabled={saving} onClick={publishBook}>Publish Book</button>
            </div>
          )}

          {book.submissionStatus === "Published" && (
            <div className="publication-form">
              <h3>Published in BookLeaf</h3>
              <p>Publication date: {showDate(book.publicationDate)}</p>
              <p>Marked published: {showDate(book.publishedAt)}</p>
              <p>No external marketplace distribution is implied.</p>
            </div>
          )}
        </section>
      </div>

      <section className="panel">
        <h2>Review history</h2>
        <ol className="review-history">
          {(book.reviewHistory || []).map((entry) => (
            <li key={entry._id || `${entry.action}-${entry.createdAt}`}>
              <div className="conversation-message-heading">
                <strong>{entry.action}</strong>
                <time dateTime={entry.createdAt}>{showDate(entry.createdAt)}</time>
              </div>
              <p>{entry.adminName || "BookLeaf"}</p>
              {entry.feedback && <p>{entry.feedback}</p>}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
