import { Route, Routes } from "react-router-dom";
import "./App.css";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import BarcodeScanPage from "./pages/BarcodeScanPage";
import MedicineDetailPage from "./pages/MedicineDetailPage";
import ReportCounterfeitPage from "./pages/ReportCounterfeitPage";
import AdminReportsPage from "./pages/AdminReportsPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/barcode" element={<BarcodeScanPage />} />
      <Route path="/medicines/:id" element={<MedicineDetailPage />} />
      <Route path="/report" element={<ReportCounterfeitPage />} />
      <Route path="/admin/reports" element={<AdminReportsPage />} />
    </Routes>
  );
}

export default App;
