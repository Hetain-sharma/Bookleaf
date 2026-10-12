import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";

export default function Books() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadBooks() {
      try {
        const response = await api.get("/books/my-books");
        setBooks(response.data.data);
      } catch (err) {
        setError(err.response?.data?.message || "Unable to load your books.");
      } finally {
        setLoading(false);
      }
    }

    loadBooks();
  }, []);

  return (
    <div className="page-heading">
      <p className="eyebrow">Your author workspace</p>
      <h1>Your bookshelf</h1>
      <p>Track each submission from review through publication, alongside your existing book performance.</p>

      <div className="book-submit-action">
        <Link className="primary-link" to="/author/books/submit">Submit a book</Link>
      </div>

      {loading && <p>Loading books...</p>}

      {error && (
        <section className="panel">
          <p>{error}</p>
        </section>
      )}

      {!loading && !error && books.length === 0 && (
        <section className="panel empty-state">
          <h3>Your shelf is waiting for its first story.</h3>
          <p>Published titles and their latest performance will appear here.</p>
        </section>
      )}

      {!loading && !error && books.length > 0 && (
        <section className="panel">
          <div className="panel-heading-row">
            <h2>Your titles</h2>
            <span className="muted">{books.length} {books.length === 1 ? "book" : "books"}</span>
          </div>
          <div className="book-list">
            {books.map((book) => (
              <article className="book-card" key={book.bookId}>
                <div>
                  <h2><Link className="book-title-link" to={`/author/books/${book.bookId}`}>{book.title}</Link></h2>
                  <p className="muted">{book.genre || "Genre unavailable"}</p>
                  <span className={`status-label book-status-${String(book.submissionStatus).toLowerCase().replaceAll(" ", "-")}`}>
                    {book.submissionStatus}
                  </span>
                  <div className="ticket-meta book-dates">
                    {book.submissionDate && <span className="muted">Submitted: {new Date(book.submissionDate).toLocaleDateString("en-IN")}</span>}
                    <span className="muted">Updated: {book.updatedAt ? new Date(book.updatedAt).toLocaleDateString("en-IN") : "Not available"}</span>
                  </div>
                  {book.adminFeedback && <p className="review-feedback-summary"><strong>Feedback:</strong> {book.adminFeedback}</p>}
                  {book.publishedAt && <p className="muted">Published in BookLeaf: {new Date(book.publishedAt).toLocaleDateString("en-IN")}</p>}
                </div>

                {(book.publishedAt || book.submissionStatus.startsWith("Published")) && (
                  <div className="book-metrics">
                    <p>
                      <strong>MRP:</strong>{" "}
                      {book.mrp == null ? "Not set" : `₹${book.mrp}`}
                    </p>
                    <p>
                      <strong>Copies sold:</strong> {book.totalCopiesSold}
                    </p>
                    <p>
                      <strong>Royalty earned:</strong> ₹
                      {book.totalRoyaltyEarned.toLocaleString("en-IN")}
                    </p>
                    <p>
                      <strong>Royalty pending:</strong> ₹
                      {book.royaltyPending.toLocaleString("en-IN")}
                    </p>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
