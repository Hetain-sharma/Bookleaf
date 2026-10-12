import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../services/api";
import PrivateBookFile from "../../components/PrivateBookFile";

function displayDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString("en-IN");
}

export default function AuthorBookDetails() {
  const { bookId } = useParams();
  const [book, setBook] = useState(null);
  const [form, setForm] = useState(null);
  const [manuscript, setManuscript] = useState(null);
  const [cover, setCover] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let current = true;
    api.get(`/books/${bookId}`)
      .then((response) => {
        if (!current) return;
        const details = response.data.data;
        setBook(details);
        setForm({
          title: details.title || "",
          subtitle: details.subtitle || "",
          synopsis: details.synopsis || "",
          genre: details.genre || "",
          language: details.language || "",
          isbn: details.isbn || "",
        });
      })
      .catch((err) => {
        if (current) setError(err.response?.data?.message || "Unable to load this book.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
  }, [bookId]);

  async function handleResubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (manuscript && manuscript.size > 20 * 1024 * 1024) {
      setError("Manuscripts must be 20 MB or smaller.");
      return;
    }
    if (cover && cover.size > 5 * 1024 * 1024) {
      setError("Cover images must be 5 MB or smaller.");
      return;
    }
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => data.append(key, value));
    if (manuscript) data.append("manuscript", manuscript);
    if (cover) data.append("cover", cover);

    try {
      setSaving(true);
      const response = await api.patch(`/books/${bookId}`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setBook(response.data.data);
      setSuccess(response.data.message || "Your changes were resubmitted.");
      setManuscript(null);
      setCover(null);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to resubmit your book.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="page-heading">Loading book submission...</p>;
  if (!book || !form) {
    return <div className="page-heading"><p className="error-message" role="alert">{error || "Book not found."}</p></div>;
  }

  const isSubmission = Boolean(book.reviewHistory?.length || book.manuscript);
  return (
    <div className="page-heading">
      <p className="eyebrow">Your author workspace / My Books</p>
      <div className="ticket-title-row">
        <div>
          <h1>{book.title}</h1>
          <p className="muted">Book ID: {book.bookId}</p>
        </div>
        <Link className="secondary-link" to="/author/books">← Back to My Books</Link>
      </div>

      <section className="panel">
        <div className="panel-heading-row">
          <h2>Submission status</h2>
          <span className="status-label">{book.submissionStatus}</span>
        </div>
        <div className="ticket-meta">
          <span className="muted">Submitted: {displayDate(book.submissionDate)}</span>
          <span className="muted">Last updated: {displayDate(book.updatedAt)}</span>
          {book.publishedAt && <span className="muted">Published: {displayDate(book.publishedAt)}</span>}
        </div>
        {book.adminFeedback && (
          <div className="review-feedback">
            <h3>Feedback from BookLeaf</h3>
            <p>{book.adminFeedback}</p>
          </div>
        )}
      </section>

      <div className="book-review-grid">
        <section className="panel">
          <h2>Book information</h2>
          {book.subtitle && <p><strong>Subtitle:</strong> {book.subtitle}</p>}
          {isSubmission && <p><strong>Author:</strong> {book.authorName}</p>}
          <p><strong>Genre:</strong> {book.genre || "Not set"}</p>
          {book.language && <p><strong>Language:</strong> {book.language}</p>}
          {book.isbn && <p><strong>ISBN:</strong> {book.isbn}</p>}
          {book.synopsis && <p className="book-synopsis">{book.synopsis}</p>}
          <h3>Cover</h3>
          <PrivateBookFile bookId={bookId} fileType="cover" file={book.coverImage} />
          <h3>Manuscript</h3>
          <PrivateBookFile bookId={bookId} fileType="manuscript" file={book.manuscript} />
        </section>

        {book.publishedAt && (
          <section className="panel">
            <h2>Publication details</h2>
            <p><strong>Publication date:</strong> {displayDate(book.publicationDate)}</p>
            <p><strong>Price:</strong> {book.publicationDetails?.mrp ? `₹${book.publicationDetails.mrp}` : "Not set"}</p>
            <p>This book is marked as published in BookLeaf. No external marketplace distribution is implied.</p>
          </section>
        )}
      </div>

      <section className="panel">
        <h2>Review history</h2>
        {!book.reviewHistory?.length && <p>No review activity yet.</p>}
        <ol className="review-history">
          {(book.reviewHistory || []).map((entry) => (
            <li key={entry._id || `${entry.action}-${entry.createdAt}`}>
              <div className="conversation-message-heading">
                <strong>{entry.action}</strong>
                <time dateTime={entry.createdAt}>{displayDate(entry.createdAt)}</time>
              </div>
              <p>{entry.adminName || "BookLeaf"}</p>
              {entry.feedback && <p>{entry.feedback}</p>}
            </li>
          ))}
        </ol>
      </section>

      {book.submissionStatus === "Changes Requested" && (
        <section className="panel form-panel">
          <h2>Update and resubmit</h2>
          <p>Address the feedback above. Replacing files is optional unless requested.</p>
          <form className="support-form book-submission-form" onSubmit={handleResubmit}>
            {[
              ["title", "Book title"],
              ["subtitle", "Subtitle"],
              ["synopsis", "Description / synopsis"],
              ["genre", "Genre"],
              ["language", "Language"],
              ["isbn", "ISBN"],
            ].map(([name, label]) => (
              <label key={name}>
                {label}
                {name === "synopsis" ? (
                  <textarea
                    name={name}
                    rows="5"
                    minLength="30"
                    maxLength="10000"
                    required
                    value={form[name]}
                    onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
                  />
                ) : (
                  <input
                    name={name}
                    maxLength={name === "title" || name === "subtitle" ? 200 : 100}
                    required={["title", "genre", "language"].includes(name)}
                    value={form[name]}
                    onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
                  />
                )}
              </label>
            ))}
            <label htmlFor="replace-manuscript">Replace manuscript (optional)</label>
            <input id="replace-manuscript" type="file" accept=".pdf,.docx" onChange={(event) => setManuscript(event.target.files?.[0] || null)} />
            <label htmlFor="replace-cover">Replace cover (optional)</label>
            <input id="replace-cover" type="file" accept=".png,.jpg,.jpeg,.webp" onChange={(event) => setCover(event.target.files?.[0] || null)} />
            {error && <p className="error-message" role="alert">{error}</p>}
            {success && <p className="success-message" role="status">{success}</p>}
            <button type="submit" className="primary-button" disabled={saving}>{saving ? "Resubmitting..." : "Resubmit for review"}</button>
          </form>
        </section>
      )}
    </div>
  );
}
