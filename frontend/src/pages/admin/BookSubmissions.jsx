import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";

const statuses = [
  "Submitted",
  "Under Review",
  "Changes Requested",
  "Approved",
  "Rejected",
  "Publishing",
  "Published",
];

export default function AdminBookSubmissions() {
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [genre, setGenre] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadSubmissions() {
      try {
        setLoading(true);
        const response = await api.get("/books/submissions", {
          params: {
            search: search || undefined,
            status: status === "all" ? undefined : status,
            genre: genre || undefined,
          },
        });
        if (active) {
          setBooks(response.data.data || []);
          setError("");
        }
      } catch (err) {
        if (active) setError(err.response?.data?.message || "Unable to load book submissions.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSubmissions();
    return () => { active = false; };
  }, [search, status, genre]);

  return (
    <div className="page-heading">
      <p className="eyebrow">Your operations workspace</p>
      <h1>Book submissions</h1>
      <p>Review author manuscripts and move approved titles through publication.</p>

      <section className="panel">
        <div className="filter-row book-submission-filters">
          <input
            type="search"
            aria-label="Search submissions by book, author, or genre"
            placeholder="Search title, author, or genre..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <input
            aria-label="Filter submissions by genre"
            placeholder="Genre"
            value={genre}
            onChange={(event) => setGenre(event.target.value)}
          />
          <select aria-label="Filter submissions by status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>

        {loading && <p>Loading book submissions...</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
        {!loading && !error && books.length === 0 && (
          <div className="empty-state">
            <h3>No submissions match these filters.</h3>
            <p>New author submissions will appear here for review.</p>
          </div>
        )}
        {!loading && !error && books.length > 0 && (
          <div className="book-list">
            {books.map((book) => (
              <article className="book-card" key={book.bookId}>
                <div>
                  <h2>{book.title}</h2>
                  <p className="muted">{book.authorName} · {book.genre} · {book.language}</p>
                  <span className="status-label">{book.submissionStatus}</span>
                  <div className="ticket-meta book-dates">
                    <span className="muted">Submitted: {new Date(book.submissionDate).toLocaleDateString("en-IN")}</span>
                    <span className="muted">Updated: {new Date(book.updatedAt).toLocaleDateString("en-IN")}</span>
                  </div>
                </div>
                <div className="book-card-action">
                  <Link className="primary-link" to={`/admin/book-submissions/${book.bookId}`}>
                    Review submission
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
