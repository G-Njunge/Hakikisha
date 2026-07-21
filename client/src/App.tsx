import { Route, Routes } from "react-router-dom";
import "./App.css";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import BarcodeScanPage from "./pages/BarcodeScanPage";
import SearchPage from "./pages/SearchPage";
import MedicineDetailPage from "./pages/MedicineDetailPage";
import ReportCounterfeitPage from "./pages/ReportCounterfeitPage";
import AdminReportsPage from "./pages/AdminReportsPage";
import DashboardPage from "./pages/DashboardPage";
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
      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute>
            <AdminReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
