import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import PersonnelPage from "./pages/PersonnelPage";
import ReferencePage from "./pages/ReferencePage";
import AssignmentsPage from "./pages/AssignmentsPage";
import UsersPage from "./pages/UsersPage";
import TransfersPage from "./pages/TransfersPage";
import RolesPage from "./pages/RolesPage";
import AuditPage from "./pages/AuditPage";
import NotificationsPage from "./pages/NotificationsPage";
import SettingsPage from "./pages/SettingsPage";

function SessionGate() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-sm font-bold text-muted" dir="rtl">جارٍ استعادة الجلسة…</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function LoginGate() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-sm font-bold text-muted" dir="rtl">جارٍ استعادة الجلسة…</div>;
  return user ? <Navigate to="/app" replace /> : <LoginPage />;
}

function PermissionGate({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { can } = useAuth();
  return can(permission)
    ? <>{children}</>
    : <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold leading-7 text-amber-900" role="alert">لا تملك الصلاحية اللازمة لعرض هذه الصفحة. إذا كان ذلك غير متوقع، تواصل مع مدير النظام.</div>;
}

function HomeRedirect() {
  const { can } = useAuth();
  if (can("reports.view")) return <Navigate to="/app/dashboard" replace />;
  if (can("personnel.manage")) return <Navigate to="/app/personnel" replace />;
  if (can("camps.manage")) return <Navigate to="/app/camps" replace />;
  if (can("users.manage")) return <Navigate to="/app/users" replace />;
  return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-900">لا يوجد قسم متاح لهذا الحساب.</div>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginGate />} />
      <Route element={<SessionGate />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<HomeRedirect />} />
          <Route path="dashboard" element={<PermissionGate permission="reports.view"><DashboardPage /></PermissionGate>} />
          <Route path="personnel" element={<PermissionGate permission="personnel.manage"><PersonnelPage /></PermissionGate>} />
          <Route path="camps" element={<PermissionGate permission="camps.manage"><ReferencePage kind="camps" /></PermissionGate>} />
          <Route path="units" element={<PermissionGate permission="units.manage"><ReferencePage kind="units" /></PermissionGate>} />
          <Route path="ranks" element={<PermissionGate permission="ranks.manage"><ReferencePage kind="ranks" /></PermissionGate>} />
          <Route path="positions" element={<PermissionGate permission="positions.manage"><ReferencePage kind="positions" /></PermissionGate>} />
          <Route path="assignments" element={<PermissionGate permission="assignments.manage"><AssignmentsPage /></PermissionGate>} />
          <Route path="transfers" element={<PermissionGate permission="transfers.manage"><TransfersPage /></PermissionGate>} />
          <Route path="users" element={<PermissionGate permission="users.manage"><UsersPage /></PermissionGate>} />
          <Route path="roles" element={<PermissionGate permission="users.manage"><RolesPage /></PermissionGate>} />
          <Route path="audit" element={<PermissionGate permission="system.admin"><AuditPage /></PermissionGate>} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<PermissionGate permission="system.admin"><SettingsPage /></PermissionGate>} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
