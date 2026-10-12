import { Navigate, Route, Routes } from "react-router-dom";
import { getStoredUser } from "../services/api";

import AuthorLayout from "../layouts/AuthorLayout";
import AdminLayout from "../layouts/AdminLayout";

import Login from "../pages/auth/Login";

import Dashboard from "../pages/author/Dashboard";
import Books from "../pages/author/Books";
import SubmitBook from "../pages/author/SubmitBook";
import AuthorBookDetails from "../pages/author/BookDetails";
import Tickets from "../pages/author/Tickets";
import AuthorTicketDetails from "../pages/author/TicketDetails";
import CreateTicket from "../pages/author/CreateTicket";

import AdminDashboard from "../pages/admin/Dashboard";
import AdminTickets from "../pages/admin/Tickets";
import AdminTicketDetails from "../pages/admin/Ticketdetails";
import AdminBookSubmissions from "../pages/admin/BookSubmissions";
import AdminBookReview from "../pages/admin/BookReview";

function ProtectedRoute({ children, allowedRoles }) {
  const token = localStorage.getItem("bookleaf_token");
  const user = getStoredUser();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return (
      <Navigate
        to={user?.role === "admin" ? "/admin/dashboard" : "/author/dashboard"}
        replace
      />
    );
  }

  return children;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />

      <Route
        path="/author"
        element={
          <ProtectedRoute allowedRoles={["author"]}>
            <AuthorLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="books" element={<Books />} />
        <Route path="books/submit" element={<SubmitBook />} />
        <Route path="books/:bookId" element={<AuthorBookDetails />} />
        <Route path="tickets" element={<Tickets />} />
        <Route path="tickets/:ticketId" element={<AuthorTicketDetails />} />
        <Route path="tickets/new" element={<CreateTicket />} />
      </Route>

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="tickets" element={<AdminTickets />} />
        <Route path="tickets/:ticketId" element={<AdminTicketDetails />} />
        <Route path="book-submissions" element={<AdminBookSubmissions />} />
        <Route path="book-submissions/:bookId" element={<AdminBookReview />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
