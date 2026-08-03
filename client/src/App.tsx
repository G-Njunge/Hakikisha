import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import BarcodeScanPage from "./pages/BarcodeScanPage";
import SearchPage from "./pages/SearchPage";
import MedicineDetailPage from "./pages/MedicineDetailPage";
import ReportCounterfeitPage from "./pages/ReportCounterfeitPage";
import DashboardPage from "./pages/DashboardPage";
import PharmacyMapPage from "./pages/PharmacyMapPage";
import LogoutPage from "./pages/LogoutPage";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {/* Scanning deliberately stays open to anonymous users — optionalAuthenticate
          on the server attributes a scan to the logged-in user when a session
          exists, but never requires one. */}
      <Route path="/barcode" element={<BarcodeScanPage />} />
      {/* Same anonymous-friendly policy as /barcode — this is its fallback,
          so it can't require something scanning itself doesn't. */}
      <Route path="/search" element={<SearchPage />} />
      <Route path="/medicines/:id" element={<MedicineDetailPage />} />
      <Route
        path="/report"
        element={
          <ProtectedRoute>
            <ReportCounterfeitPage />
          </ProtectedRoute>
        }
      />
      {/* Admin management moved into the Dashboard's own tabs (Overview /
          Manage reports) rather than a separate nav link — this keeps any
          old bookmark/link working. */}
      <Route path="/admin/reports" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pharmacy"
        element={
          <ProtectedRoute>
            <PharmacyMapPage />
          </ProtectedRoute>
        }
      />
      {/* Not gated by ProtectedRoute — it must still render its confirm/done
          states even if a session already expired by the time it's opened. */}
      <Route path="/logout" element={<LogoutPage />} />
    </Routes>
  );
}

export default App;
