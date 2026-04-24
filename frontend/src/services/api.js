import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api",
  timeout: 15000
});

// Patterns that should never be shown to users
const SENSITIVE_PATTERNS = [
  "Failed to determine project ID",
  "ENOTFOUND",
  "metadata.google.internal",
  "getaddrinfo",
  "ECONNREFUSED",
  "Error while making request",
  "socket hang up",
  "serviceAccount",
  "applicationDefault"
];

function isSensitiveMessage(msg) {
  const str = String(msg || "").toLowerCase();
  return SENSITIVE_PATTERNS.some((p) => str.includes(p.toLowerCase()));
}

// Global response interceptor — sanitize all error responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const serverError = error?.response?.data?.error || error?.message || "";
    if (isSensitiveMessage(serverError)) {
      // Replace with a clean, user-friendly message
      if (error.response?.data) {
        error.response.data.error = "A service error occurred. Please try again later.";
      }
    }
    return Promise.reject(error);
  }
);

export function setAuthToken(token) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}
