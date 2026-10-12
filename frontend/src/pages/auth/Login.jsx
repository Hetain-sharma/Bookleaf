import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { setAuthToken } from "../../services/api";

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await api.post("/auth/login", formData);
      const { token, user } = response.data;

      setAuthToken(token, user);
      navigate(user.role === "admin" ? "/admin/dashboard" : "/author/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  return (
    <main className="login-page">
      <section className="login-story" aria-label="BookLeaf publishing">
        <div className="login-brand">
          <span className="portal-brand-mark" aria-hidden="true">B</span>
          <span>BookLeaf</span>
        </div>
        <div className="login-story-content">
          <span className="login-story-kicker">A home for your stories</span>
          <h2>Your words.<br />Our whole-hearted support.</h2>
          <p>Keep your books, publishing updates, and the people who help bring your work to life all in one place.</p>
          <div className="story-book-stack" aria-hidden="true">
            <span className="story-book">Stories</span>
            <span className="story-book">Ideas</span>
            <span className="story-book">Words</span>
            <span className="story-book">Wonder</span>
            <span className="story-book">Pages</span>
          </div>
        </div>
        <span className="login-story-footer">Made for the people behind every page.</span>
      </section>

      <section className="login-form-side">
        <div className="login-card">
          <span className="portal-brand-mark" aria-hidden="true">B</span>
          <p className="eyebrow">Author &amp; support portal</p>
          <h2>Welcome back</h2>
          <p>Sign in to pick up where your story left off.</p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              required
            />

            {error && <p className="error-message" role="alert">{error}</p>}

            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in to BookLeaf"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
