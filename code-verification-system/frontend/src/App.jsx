import { Routes, Route, Navigate } from 'react-router-dom';
import VerifyPage from './pages/VerifyPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import DashboardPage from './pages/admin/DashboardPage.jsx';
import CodesPage from './pages/admin/CodesPage.jsx';
import GeneratePage from './pages/admin/GeneratePage.jsx';
import BatchesPage from './pages/admin/BatchesPage.jsx';
import SettingsPage from './pages/admin/SettingsPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<VerifyPage />} />
      <Route path="/admin/login" element={<LoginPage />} />
      <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="codes" element={<CodesPage />} />
        <Route path="generate" element={<GeneratePage />} />
        <Route path="batches" element={<BatchesPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
