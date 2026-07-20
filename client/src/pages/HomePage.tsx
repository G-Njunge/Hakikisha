import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function HomePage() {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  if (isLoading) {
    return <p>Loading...</p>;
  }

  if (!user) {
    return (
      <div>
        <h1>Hakikisha</h1>
        <p>You are not logged in.</p>
        <p>
          <Link to="/login">Login</Link> or <Link to="/register">Register</Link>
        </p>
        <p>
          <Link to="/barcode">Scan barcode</Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1>Hakikisha</h1>
      <p>
        Logged in as {user.fullName} ({user.email})
      </p>
      <p>Role: {user.role}</p>
      <p>Country: {user.country}</p>
      <p>
        <Link to="/barcode">Scan barcode</Link>
      </p>
      <p>
        <Link to="/report">Report counterfeit medicine</Link>
      </p>
      <p>
        <Link to="/dashboard">My dashboard</Link>
      </p>
      {user.role === "admin" && (
        <p>
          <Link to="/admin/reports">Admin: Review reports</Link>
        </p>
      )}
      <button type="button" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}
