import { useState } from "react";
import { Link } from "react-router-dom";
import { getStoredUser } from "../../services/api";
import api from "../../services/api";

const sampleBookData = {
  title: "The Midnight Orchard",
  subtitle: "A novel of memory, belonging, and second chances",
  synopsis:
    "A small-town archivist uncovers a forgotten family ledger that maps a hidden orchard and a decades-old promise. As she follows the trail, she must reconcile grief, identity, and the courage to start again.",
  genre: "Literary Fiction",
  language: "English",
  isbn: "978-1-4028-9462-7",
};

export default function SubmitBook() {
  const user = getStoredUser();
  const [form, setForm] = useState(sampleBookData);
  const [manuscript, setManuscript] = useState(null);
  const [cover, setCover] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submittedBookId, setSubmittedBookId] = useState("");

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!manuscript || !cover) {
      setError("Upload both the manuscript and cover image.");
      return;
    }
    if (manuscript.size > 20 * 1024 * 1024 || cover.size > 5 * 1024 * 1024) {
      setError("Manuscripts must be 20 MB or smaller and cover images 5 MB or smaller.");
      return;
    }

    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => data.append(key, value));
    data.append("manuscript", manuscript);
    data.append("cover", cover);

    try {
      setLoading(true);
      const response = await api.post("/books/submissions", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSuccess(response.data.message || "Your book was submitted for review.");
      setSubmittedBookId(response.data.data.bookId);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to submit your book.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-heading">
      <p className="eyebrow">Your author workspace</p>
      <h1>Submit a book</h1>
      <p>Send your manuscript to the BookLeaf team for review. It will not be published until an administrator approves and publishes it.</p>

      <section className="panel form-panel">
        <form className="support-form book-submission-form" onSubmit={handleSubmit}>
          <div className="form-intro">
            <h2>Book details</h2>
            <p>Your submission files are private and can only be accessed by you and authorized administrators.</p>
          </div>

          <label htmlFor="book-title">Book title</label>
          <input id="book-title" name="title" maxLength="200" required value={form.title} onChange={handleChange} />

          <label htmlFor="book-subtitle">Subtitle <span className="muted">(optional)</span></label>
          <input id="book-subtitle" name="subtitle" maxLength="200" value={form.subtitle} onChange={handleChange} />

          <label htmlFor="book-synopsis">Description / synopsis</label>
          <textarea id="book-synopsis" name="synopsis" minLength="30" maxLength="10000" rows="6" required value={form.synopsis} onChange={handleChange} />

          <div className="form-field-grid">
            <div>
              <label htmlFor="book-genre">Genre / category</label>
              <input id="book-genre" name="genre" maxLength="100" required value={form.genre} onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="book-language">Language</label>
              <input id="book-language" name="language" maxLength="80" required value={form.language} onChange={handleChange} />
            </div>
          </div>

          <label htmlFor="book-author">Author name</label>
          <input id="book-author" value={user?.name || "Your authenticated profile"} readOnly aria-readonly="true" />
          <p className="muted">Your author identity is set from your authenticated account.</p>

          <label htmlFor="book-isbn">ISBN <span className="muted">(optional, if assigned)</span></label>
          <input id="book-isbn" name="isbn" maxLength="20" value={form.isbn} onChange={handleChange} />

          <label htmlFor="manuscript">Manuscript (PDF or DOCX, max 20 MB)</label>
          <input
            id="manuscript"
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            required
            onChange={(event) => setManuscript(event.target.files?.[0] || null)}
          />

          <label htmlFor="cover">Cover image (PNG, JPG, or WebP, max 5 MB)</label>
          <input
            id="cover"
            type="file"
            accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
            required
            onChange={(event) => setCover(event.target.files?.[0] || null)}
          />

          {error && <p className="error-message" role="alert">{error}</p>}
          {success && <p className="success-message" role="status">{success}</p>}
          {submittedBookId && (
            <Link className="primary-link" to={`/author/books/${submittedBookId}`}>
              Track this submission
            </Link>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="secondary-link"
              onClick={() => setForm(sampleBookData)}
              style={{ marginRight: "0.75rem" }}
            >
              Use sample data
            </button>
            <button type="submit" className="primary-button" disabled={loading || Boolean(submittedBookId)}>
              {loading ? "Submitting..." : submittedBookId ? "Submitted" : "Submit for review"}
            </button>
            <Link className="secondary-link" to="/author/books">Back to My Books</Link>
          </div>
        </form>
      </section>
    </div>
  );
}
