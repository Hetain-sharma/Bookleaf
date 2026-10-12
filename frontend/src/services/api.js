import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("bookleaf_token");

  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("bookleaf_token");
      localStorage.removeItem("bookleaf_user");
    }
    return Promise.reject(error);
  },
);

export function setAuthToken(token, user) {
  if (token) {
    localStorage.setItem("bookleaf_token", token);
    if (user) {
      localStorage.setItem("bookleaf_user", JSON.stringify(user));
    }
    return;
  }

  localStorage.removeItem("bookleaf_token");
  localStorage.removeItem("bookleaf_user");
}

export function getStoredUser() {
  try {
    const user = localStorage.getItem("bookleaf_user");
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

export default api;
