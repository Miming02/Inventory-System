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
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (targetPage = page) => {
    if (!canManageUsers(role)) return;
    setLoading(true);
    setError("");
    const from = (targetPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE;
    const { data, error: qErr } = await supabase
      .from("audit_logs")
      .select("id,created_at,action,table_name,record_id,user_id")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (qErr) {
      setError(getErrorMessage(qErr));
      setRows([]);
      setHasMore(false);
    } else {
      const fetched = data ?? [];
      setRows(fetched.slice(0, PAGE_SIZE));
      setHasMore(fetched.length > PAGE_SIZE);
      setPage(targetPage);
    }
    setLoading(false);
  }, [role, page]);

  useEffect(() => {
    if (!authLoading && canManageUsers(role)) load(1);
  }, [authLoading, role, load]);

  if (!authLoading && !canManageUsers(role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-dvh bg-surface text-on-surface pb-16">
      <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-white/80 shadow-sm shadow-blue-900/5 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8 max-w-[1440px]">
          <div>
            <Link to="/dashboard" className="text-sm font-semibold text-primary hover:underline">
              ← Dashboard
            </Link>
            <h1 className="text-xl font-extrabold tracking-tight mt-0.5">Audit Log</h1>
            <p className="text-xs text-on-surface-variant mt-0.5">
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

      <main className="mx-auto w-full max-w-[1600px] px-2 pb-10 pt-[4.4rem] sm:px-3 lg:px-4">
        <section className="px-1 py-2 sm:px-2">
          <div className="relative mx-auto w-full overflow-hidden rounded-[2rem] border border-outline-variant/15 bg-gradient-to-b from-surface-container-lowest to-surface shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
            <Link
              to="/system-settings"
              className="absolute right-5 top-5 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/20 bg-white/90 text-on-surface-variant shadow-sm transition-all hover:border-error/20 hover:bg-white hover:text-error"
              aria-label="Close"
              title="Close"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </Link>
            <section className="relative min-h-0 overflow-auto bg-transparent p-4 sm:p-6 lg:p-8">
              <div className="mx-auto max-w-[1180px] space-y-6">
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
              <div className="flex items-center justify-between rounded-xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
                <p className="text-sm text-on-surface-variant">
                  Page {page}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => load(page - 1)}
                    disabled={loading || page <= 1}
                    className="rounded-full border border-outline-variant/20 px-4 py-1.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => load(page + 1)}
                    disabled={loading || !hasMore}
                    className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
