import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AdminDashboard from "./pages/dashboard/AdminDashboard";
import ReceiveInventory from "./pages/receive/ReceiveInventory";
import TransferInventory from "./pages/transfer/TransferInventory";
import DeliverInventory from "./pages/deliver/DeliverInventory";
import CountInventory from "./pages/count/CountInventory";
import DisposeInventory from "./pages/dispose/DisposeInventory";
import InventoryItems from "./pages/inventory/InventoryItems";
import PurchaseOrders from "./pages/purchase-orders/PurchaseOrders";
import GenerateReports from "./pages/reports/GenerateReports";
import Login from "./pages/auth/Login";
import Users from "./pages/admin/Users";
import AuditLogs from "./pages/admin/AuditLogs";
import ManageSuppliers from "./pages/admin/ManageSuppliers";
import ManageLocations from "./pages/admin/ManageLocations";
import ManageBomAndConversions from "./pages/admin/ManageBomAndConversions";
import SystemSettings from "./pages/admin/SystemSettings";
import BomManagement from "./pages/bom/BomManagement";
import LandingPage from "./pages/public/LandingPage";
import ProduceInventory from "./pages/produce/ProduceInventory";
import ApprovalsPage from "./pages/approvals/ApprovalsPage";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { canAccessPath } from "./lib/roleAccess";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;

  return children;
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  return children;
}

function LandingEntry() {
  return <LandingPage />;
}

function RoleGuard({ children }) {
  const { role, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading) return null;
  if (!canAccessPath(role, pathname)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/"
          element={<LandingEntry />}
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory"
          element={
            <ProtectedRoute>
              <RoleGuard>
                <InventoryItems />
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/receive"
          element={
            <ProtectedRoute>
              <RoleGuard>
                <ReceiveInventory />
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transfer"
          element={
            <ProtectedRoute>
              <RoleGuard>
                <TransferInventory />
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/deliver"
          element={
            <ProtectedRoute>
              <RoleGuard>
                <DeliverInventory />
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/count"
          element={
            <ProtectedRoute>
              <RoleGuard>
                <CountInventory />
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dispose"
          element={
            <ProtectedRoute>
              <RoleGuard>
                <DisposeInventory />
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/purchase-orders"
          element={
            <ProtectedRoute>
              <RoleGuard>
                <PurchaseOrders />
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <RoleGuard>
                <GenerateReports />
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <RoleGuard>
                <Users />
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <ProtectedRoute>
              <RoleGuard>
                <AuditLogs />
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/manage-suppliers"
          element={
            <ProtectedRoute>
              <RoleGuard>
                <ManageSuppliers />
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/manage-locations"
          element={
            <ProtectedRoute>
              <RoleGuard>
                <ManageLocations />
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/bom"
          element={
            <ProtectedRoute>
              <RoleGuard>
                <BomManagement />
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/produce"
          element={
            <ProtectedRoute>
              <RoleGuard>
                <ProduceInventory />
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/consume"
          element={
            <ProtectedRoute>
              <RoleGuard>
                <ProduceInventory />
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/approvals"
          element={
            <ProtectedRoute>
              <RoleGuard>
                <ApprovalsPage />
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <RoleGuard>
                <SystemSettings />
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/system-settings"
          element={
            <ProtectedRoute>
              <RoleGuard>
                <SystemSettings />
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/manage-bom"
          element={
            <ProtectedRoute>
              <RoleGuard>
                <Navigate to="/bom" replace />
              </RoleGuard>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
