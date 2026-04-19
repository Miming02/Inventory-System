import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AdminDashboard from "./pages/dashboard/AdminDashboard";
import ReceiveInventory from "./pages/receive/ReceiveInventory";
import TransferInventory from "./pages/transfer/TransferInventory";
import DeliverInventory from "./pages/deliver/DeliverInventory";
import CountInventory from "./pages/count/CountInventory";
import DisposeInventory from "./pages/dispose/DisposeInventory";
import InventoryItems from "./pages/inventory/InventoryItems";
import PurchaseOrders from "./pages/purchase-orders/PurchaseOrders";
import Login from "./pages/auth/Login";
import Users from "./pages/admin/Users";
import AuditLogs from "./pages/admin/AuditLogs";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { canAccessPath } from "./lib/roleAccess";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return children;
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  return children;
}

function RoleGuard({ children }) {
  const { role, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading) return null;
  if (!canAccessPath(role, pathname)) {
    return <Navigate to="/" replace />;
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
