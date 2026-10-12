import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";

const categoryOptions = [
  "Royalty",
  "Publishing",
  "Book updates",
  "Distribution",
  "Account",
  "General",
];

const sampleTicketData = {
  subject: "Royalty payout status for my latest title",
  description:
    "Hi BookLeaf team, I would like to confirm the royalty payout status for my latest title. Please let me know whether the current balance has been processed and when I can expect the next payout report.",
  category: "Royalty",
  priority: "Medium",
};

export default function CreateTicket() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(sampleTicketData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await api.post("/tickets", formData);
      setSuccess("Ticket submitted successfully.");
      setTimeout(() => navigate("/author/tickets"), 500);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to submit your ticket.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-heading">
      <p className="eyebrow">Your author workspace</p>
      <h1>How can we help?</h1>
      <p>Tell us a little about what you need, and our team will take it from here.</p>

      <section className="panel form-panel">
        <form className="support-form" onSubmit={handleSubmit}>
          <div className="form-intro">
            <h2>Start a support request</h2>
            <p>Share the details below so we can get your question to the right person.</p>
          </div>
          <label htmlFor="category">Category</label>
          <select id="category" name="category" value={formData.category} onChange={handleChange}>
            {categoryOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>

          <label htmlFor="priority">Priority</label>
          <select id="priority" name="priority" value={formData.priority} onChange={handleChange}>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>

          <label htmlFor="subject">Subject</label>
          <input
            id="subject"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            placeholder="Briefly describe your issue"
            required
          />

          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            rows="6"
            value={formData.description}
            onChange={handleChange}
            placeholder="Explain your issue in detail..."
            required
          />

          {error && <p className="error-message" role="alert">{error}</p>}
          {success && <p className="success-message" role="status">{success}</p>}

          <div className="form-actions">
            <button
              type="button"
              className="secondary-link"
              onClick={() => setFormData(sampleTicketData)}
              style={{ marginRight: "0.75rem" }}
            >
              Use sample data
            </button>
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? "Submitting..." : "Submit Ticket"}
            </button>
            <Link className="secondary-link" to="/author/tickets">
              Back to My Tickets
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
