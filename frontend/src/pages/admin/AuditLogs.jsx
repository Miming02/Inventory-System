import { useEffect, useState, useCallback } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../contexts/AuthContext";
import { canManageUsers } from "../../lib/roleAccess";

const PAGE_SIZE = 50;

export default function AuditLogs() {
  const { role, loading: authLoading } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!canManageUsers(role)) return;
    setLoading(true);
    setError("");
    const { data, error: qErr } = await supabase
      .from("audit_logs")
      .select("id,created_at,action,table_name,record_id,user_id")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (qErr) {
      setError(getErrorMessage(qErr));
      setRows([]);
    } else {
      setRows(data ?? []);
    }
    setLoading(false);
  }, [role]);

  useEffect(() => {
    if (!authLoading && canManageUsers(role)) load();
  }, [authLoading, role, load]);

  if (!authLoading && !canManageUsers(role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="bg-background text-on-surface min-h-screen pb-16">
      <header className="border-b border-outline-variant/20 bg-surface-container-lowest/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <Link to="/" className="text-sm font-semibold text-primary hover:underline">
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-extrabold tracking-tight mt-1">Audit log</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Recent changes (profiles, inventory, purchase orders). Admin only.
            </p>
          </div>
          <button
            type="button"
            onClick={() => load()}
            className="shrink-0 px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90"
          >
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {error ? (
          <div className="rounded-xl bg-error-container text-on-error-container p-4 text-sm mb-6">
            <p className="font-semibold">Could not load audit log</p>
            <p className="mt-1 opacity-90">{error}</p>
            <p className="mt-2 text-xs opacity-80">
              If you just added RLS for <code className="bg-black/10 px-1 rounded">audit_logs</code>, run migration{" "}
              <code className="bg-black/10 px-1 rounded">002_audit_logs_rls.sql</code> in Supabase and set{" "}
              <code className="bg-black/10 px-1 rounded">audit_trigger</code> to <code className="bg-black/10 px-1 rounded">SECURITY DEFINER</code>.
            </p>
          </div>
        ) : null}

        <div className="rounded-2xl border border-outline-variant/15 overflow-hidden bg-surface-container-lowest shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant/10">
                  <th className="px-4 py-3 font-semibold text-on-surface-variant">When</th>
                  <th className="px-4 py-3 font-semibold text-on-surface-variant">Action</th>
                  <th className="px-4 py-3 font-semibold text-on-surface-variant">Table</th>
                  <th className="px-4 py-3 font-semibold text-on-surface-variant">Record</th>
                  <th className="px-4 py-3 font-semibold text-on-surface-variant">User id</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-on-surface-variant">
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-on-surface-variant">
                      No audit rows yet. Changes to tracked tables will appear here.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-container-low/50">
                      <td className="px-4 py-2.5 whitespace-nowrap text-on-surface-variant">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{r.action ?? "—"}</td>
                      <td className="px-4 py-2.5">{r.table_name ?? "—"}</td>
                      <td className="px-4 py-2.5 font-mono text-xs max-w-[180px] truncate" title={r.record_id ?? ""}>
                        {r.record_id ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs max-w-[140px] truncate" title={r.user_id ?? ""}>
                        {r.user_id ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
