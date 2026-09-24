import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAdminPath } from './components/RequireAdminPath';
import { RequireAuth } from './components/RequireAuth';
import { AuthProvider } from './contexts/AuthContext';
import { AccountsPage } from './pages/admin/AccountsPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminLayout } from './pages/admin/AdminLayout';
import { FloorPlanPage } from './pages/admin/FloorPlanPage';
import { HistoryPage } from './pages/admin/HistoryPage';
import { ImportPage } from './pages/admin/ImportPage';
import { LoginPage } from './pages/admin/LoginPage';
import { OrganizationsPage } from './pages/admin/OrganizationsPage';
import { PreviewPage } from './pages/admin/PreviewPage';
import { RoomsPage } from './pages/admin/RoomsPage';
import { SecurityPage } from './pages/admin/SecurityPage';
import { StatusPage } from './pages/admin/StatusPage';
import { DirectoryPage } from './pages/admin/DirectoryPage';
import { DisplayPage } from './pages/display/DisplayPage';
import { LobbyPage } from './pages/display/LobbyPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/lobby" element={<Navigate to="/display/lobby" replace />} />
        <Route path="/display/lobby" element={<LobbyPage />} />
        <Route path="/display/:slug" element={<DisplayPage />} />
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={<RequireAuth />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="organizations" element={<OrganizationsPage />} />
            <Route path="security" element={<SecurityPage />} />
            <Route path="preview" element={<PreviewPage />} />
            <Route element={<RequireAdminPath />}>
              <Route path="accounts" element={<AccountsPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="floor-plan" element={<FloorPlanPage />} />
              <Route path="import" element={<ImportPage />} />
              <Route path="rooms" element={<RoomsPage />} />
              <Route path="status" element={<StatusPage />} />
              <Route path="directory" element={<DirectoryPage />} />
            </Route>
            <Route path="events" element={<Navigate to="/admin" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AuthProvider>
  );
}
