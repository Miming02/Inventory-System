import { Link } from "react-router-dom";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../contexts/AuthContext";
import { useDistinctLocations } from "../../lib/useDistinctLocations";
import { UserAvatarOrIcon } from "../../components/UserAvatarOrIcon";

const filterOptions = ["All", "Pending", "Approved", "Rejected"];

function formatAdjustmentType(t) {
  const s = (t || "").replace(/_/g, " ");
  return s ? s.replace(/\b\w/g, (c) => c.toUpperCase()) : "—";
}

function profileFromEmbed(p) {
  if (!p) return null;
  return Array.isArray(p) ? p[0] ?? null : p;
}

function profileLabel(p) {
  const row = profileFromEmbed(p);
  if (!row) return "—";
  const fn = (row.first_name || "").trim();
  const ln = (row.last_name || "").trim();
  if (fn || ln) return [fn, ln].filter(Boolean).join(" ");
  return "Team member";
}

function profileAvatar(p) {
  const row = profileFromEmbed(p);
  return row?.avatar_url || null;
}

function rowStatus(row) {
  if (row.approved_by) return "approved";
  return "pending";
}

function StatusBadge({ status }) {
  if (status === "pending") {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-fixed-variant text-xs font-bold">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        Pending
      </div>
    );
  }
  if (status === "approved") {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
        <span className="material-symbols-outlined text-[14px]">check_circle</span>
        Approved
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold">
      <span className="material-symbols-outlined text-[14px]">cancel</span>
      Rejected
    </div>
  );
}

function ApproverCell({ approverEmbed, approvedById }) {
  if (!approvedById) {
    return <span className="text-xs text-on-surface-variant italic">TBD</span>;
  }
  const name = profileLabel(approverEmbed);
  return (
    <div className="flex items-center gap-2">
      <UserAvatarOrIcon src={profileAvatar(approverEmbed)} alt={name} size="sm" />
      <span className="text-xs font-medium">{name}</span>
    </div>
  );
}

function CreateDisposalRequestModal({ open, onClose, profile, locations }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const requesterName = profileLabel(profile);
  const dept = (profile?.department || "").trim() || "—";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-on-surface/20 p-4 backdrop-blur-[12px] transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-disposal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[min(921px,92vh)] w-full max-w-2xl flex-col overflow-y-auto rounded-xl bg-surface-container-lowest shadow-[0_12px_32px_-4px_rgba(23,28,31,0.06)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between bg-surface-container-lowest p-8 pb-4">
          <div className="space-y-1 pr-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="create-disposal-title" className="font-headline text-xl font-extrabold tracking-tight text-on-surface">
                Create disposal request
              </h2>
              <span className="rounded-full bg-secondary-container px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-on-secondary-container">
                Draft
              </span>
            </div>
            <p className="text-sm font-medium text-on-surface-variant">
              Submit adjustments (damage, expired, loss, write-off) — save action will connect to{" "}
              <code className="text-[10px]">stock_adjustments</code> later.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-8 p-8 pt-2">
          <div className="flex flex-wrap items-center gap-4 rounded-xl bg-surface-container-low p-4 sm:flex-nowrap">
            <UserAvatarOrIcon src={profile?.avatar_url} alt={requesterName} size="lg" />
            <div className="min-w-[140px] flex-1">
              <p className="text-xs font-medium text-on-surface-variant">Requested by</p>
              <p className="font-bold tracking-tight text-on-surface">{requesterName}</p>
            </div>
            <div className="hidden h-8 w-px shrink-0 bg-outline-variant/30 sm:block" />
            <div className="min-w-[140px] flex-1">
              <p className="text-xs font-medium text-on-surface-variant">Department</p>
              <p className="font-bold tracking-tight text-on-surface">{dept}</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Item selection *</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant">
                    search
                  </span>
                  <input
                    className="w-full rounded-xl border-none bg-surface-container-highest py-3 pl-10 pr-4 text-sm transition-all placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-primary/20"
                    placeholder="Search item name or SKU (wire to inventory)"
                    type="text"
                    disabled
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Quantity *</label>
                <input
                  className="w-full rounded-xl border-none bg-surface-container-highest px-4 py-3 text-sm transition-all focus:ring-2 focus:ring-primary/20"
                  placeholder="0"
                  type="number"
                  disabled
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Location *</label>
                <select
                  className="w-full appearance-none rounded-xl border-none bg-surface-container-highest px-4 py-3 text-sm transition-all focus:ring-2 focus:ring-primary/20"
                  disabled
                  defaultValue=""
                >
                  <option value="">Warehouse location (from inventory)</option>
                  {locations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Date *</label>
                <input
                  className="w-full rounded-xl border-none bg-surface-container-highest px-4 py-3 text-sm transition-all focus:ring-2 focus:ring-primary/20"
                  type="date"
                  disabled
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Reason *</label>
              <select
                className="mb-3 w-full appearance-none rounded-xl border-none bg-surface-container-highest px-4 py-3 text-sm transition-all focus:ring-2 focus:ring-primary/20"
                disabled
                defaultValue=""
              >
                <option value="">Matches DB: damage, expired, loss, correction, write_off</option>
              </select>
              <textarea
                className="w-full resize-none rounded-xl border-none bg-surface-container-highest px-4 py-3 text-sm transition-all placeholder:text-on-surface-variant/60 focus:ring-2 focus:ring-primary/20"
                placeholder="Additional details (saved to reason text when wired)"
                rows={3}
                disabled
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 border-t border-outline-variant/15 pt-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Approver *</label>
              <select className="w-full appearance-none rounded-xl border-none bg-surface-container-highest px-4 py-3 text-sm" disabled defaultValue="">
                <option value="">Supervisor / admin (list from profiles later)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Proof of condition</label>
              <button
                type="button"
                disabled
                className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl border-2 border-dashed border-outline-variant/30 bg-surface-container-low p-3 opacity-70"
              >
                <span className="material-symbols-outlined text-primary">upload_file</span>
                <span className="text-xs font-medium text-on-surface-variant">Attachments (storage) — soon</span>
              </button>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-4 border-t border-outline-variant/15 bg-surface-container-lowest p-8">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-8 py-3 text-sm font-bold text-secondary transition-all hover:bg-surface-container-low"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-full bg-gradient-to-r from-primary/50 to-primary-container/50 px-8 py-3 text-sm font-bold text-on-primary opacity-80 shadow-lg shadow-primary/10"
          >
            Submit (soon)
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DisposeInventory() {
  const { profile } = useAuth();
  const [filter, setFilter] = useState("All");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const closeCreateModal = useCallback(() => setCreateModalOpen(false), []);
  const modalLocations = useDistinctLocations(createModalOpen);

  const [rawRows, setRawRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      const base =
        "id, adjustment_number, adjustment_type, quantity, reason, created_at, approved_by, created_by, inventory_items ( name, sku ), creator:profiles!stock_adjustments_created_by_fkey ( first_name, last_name, avatar_url ), approver:profiles!stock_adjustments_approved_by_fkey ( first_name, last_name, avatar_url )";
      let { data, error } = await supabase.from("stock_adjustments").select(base).order("created_at", { ascending: false }).limit(200);
      if (error) {
        const fallback = await supabase
          .from("stock_adjustments")
          .select(
            "id, adjustment_number, adjustment_type, quantity, reason, created_at, approved_by, created_by, inventory_items ( name, sku )"
          )
          .order("created_at", { ascending: false })
          .limit(200);
        data = fallback.data;
        error = fallback.error;
      }
      if (cancelled) return;
      if (error) setLoadError(getErrorMessage(error));
      else setRawRows(data ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enriched = useMemo(() => {
    return rawRows.map((r) => {
      const inv = r.inventory_items;
      const item = Array.isArray(inv) ? inv[0] : inv;
      const status = rowStatus(r);
      return {
        ...r,
        _itemName: item?.name ?? "—",
        _sku: item?.sku ?? "—",
        _status: status,
        _when: r.created_at ? new Date(r.created_at).toLocaleString() : "—",
      };
    });
  }, [rawRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((r) => {
      if (filter === "Pending" && r._status !== "pending") return false;
      if (filter === "Approved" && r._status !== "approved") return false;
      if (filter === "Rejected" && r._status !== "rejected") return false;
      if (!q) return true;
      const blob = [r.adjustment_number, r._itemName, r._sku, r.reason, r.adjustment_type].join(" ").toLowerCase();
      return blob.includes(q);
    });
  }, [enriched, filter, search]);

  const stats = useMemo(() => {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const thisMonth = rawRows.filter((r) => r.created_at && r.created_at >= startMonth).length;
    const pending = rawRows.filter((r) => !r.approved_by).length;
    return { thisMonth, pending, total: rawRows.length };
  }, [rawRows]);

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <header className="fixed top-0 z-50 w-full bg-white/80 bg-gradient-to-b from-white to-transparent shadow-sm shadow-blue-500/5 backdrop-blur-xl dark:from-slate-900 dark:bg-slate-900/80">
        <div className="mx-auto flex h-20 w-full max-w-[1440px] items-center justify-between px-8">
          <div className="font-manrope text-2xl font-extrabold tracking-tighter text-slate-900 dark:text-white">
            The Fluid Curator
          </div>
          <nav className="hidden items-center gap-8 font-manrope font-semibold tracking-tight md:flex">
            <Link to="/" className="text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
              Dashboard
            </Link>
            <span className="border-b-2 border-blue-600 pb-1 text-blue-600 dark:border-blue-400 dark:text-blue-400">Dispose</span>
            <Link to="/inventory" className="text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
              Inventory
            </Link>
            <Link to="/" className="text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
              Home
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="scale-95 rounded-lg p-2 transition-transform duration-200 hover:bg-slate-50/50 active:scale-90 dark:hover:bg-slate-800/50"
              >
                <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
              </button>
              <UserAvatarOrIcon
                src={profile?.avatar_url}
                alt={profileLabel(profile)}
                size="lg"
                className="ring-2 ring-surface-container-high"
              />
            </div>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="scale-95 rounded-full bg-gradient-to-r from-primary to-primary-container px-6 py-2.5 font-manrope text-sm font-semibold text-on-primary shadow-lg shadow-primary/20 transition-transform duration-200 active:scale-90"
            >
              Create request
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-8 pb-28 pt-32 md:pb-20">
        <div className="mb-10">
          <h1 className="mb-2 font-manrope text-4xl font-extrabold tracking-tight text-on-surface">Disposal & adjustments</h1>
          <p className="text-lg text-on-surface-variant">
            Live rows from <code className="text-sm">stock_adjustments</code> (write-offs, damage, expired, loss, correction)
          </p>
        </div>

        <section className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
          <div className="flex flex-col justify-between gap-6 bg-surface-bright p-6 md:flex-row md:items-center">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
              {filterOptions.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setFilter(label)}
                  className={
                    filter === label
                      ? "shrink-0 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary transition-all"
                      : "shrink-0 rounded-full px-5 py-2 text-sm font-semibold text-on-surface-variant transition-all hover:bg-surface-container-high"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-80">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-xl text-on-surface-variant">
                search
              </span>
              <input
                className="w-full rounded-xl border-none bg-surface-container-highest py-2.5 pl-11 pr-4 text-on-surface transition-all placeholder:text-on-surface-variant/60 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20"
                placeholder="Search number, item, reason…"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse text-left">
              <thead>
                <tr className="border-none bg-surface-container-low">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Request #</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Item</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Qty</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Type</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Reason</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Requestor</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Date</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-on-surface-variant">Approver</th>
                  <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-on-surface-variant">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant/30">
                {loadError ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-8 text-sm text-error">
                      {loadError}
                    </td>
                  </tr>
                ) : loading ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-8 text-sm text-on-surface-variant">
                      Loading…
                    </td>
                  </tr>
                ) : filter === "Rejected" ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-8 text-sm text-on-surface-variant">
                      Walang &quot;rejected&quot; state sa <code className="text-xs">stock_adjustments</code> schema; pending = walang{" "}
                      <code className="text-xs">approved_by</code>, approved = may approver.
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-8 text-sm text-on-surface-variant">
                      Walang row. Mag-insert ng adjustments sa database para lumitaw dito.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-surface-container-low/50">
                      <td className="px-6 py-5 font-mono text-sm font-semibold text-primary">{row.adjustment_number}</td>
                      <td className="px-6 py-5">
                        <div className="font-semibold text-on-surface">{row._itemName}</div>
                        <div className="text-xs font-mono text-on-surface-variant">{row._sku}</div>
                      </td>
                      <td className="px-6 py-5 text-on-surface-variant">{row.quantity}</td>
                      <td className="px-6 py-5">
                        <span className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-medium text-on-surface-variant">
                          {formatAdjustmentType(row.adjustment_type)}
                        </span>
                      </td>
                      <td className="max-w-[200px] truncate px-6 py-5 text-sm text-on-surface-variant" title={row.reason}>
                        {row.reason || "—"}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <UserAvatarOrIcon src={profileAvatar(row.creator)} alt={profileLabel(row.creator)} size="md" />
                          <span className="text-sm font-medium text-on-surface">{profileLabel(row.creator)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm text-on-surface-variant">{row._when}</td>
                      <td className="px-6 py-5">
                        <StatusBadge status={row._status} />
                      </td>
                      <td className="px-6 py-5">
                        <ApproverCell approverEmbed={row.approver} approvedById={row.approved_by} />
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className="text-sm font-semibold text-on-surface-variant">View</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-surface-variant/20 bg-surface-bright p-6">
            <span className="text-sm text-on-surface-variant">
              {loading ? "…" : `Showing ${filtered.length} of ${enriched.length} adjustment(s)`}
            </span>
          </div>
        </section>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="flex h-40 flex-col justify-between rounded-xl bg-primary/5 p-6">
            <span className="text-sm font-bold uppercase tracking-widest text-primary">This month</span>
            <div className="flex items-end justify-between">
              <span className="font-manrope text-4xl font-extrabold text-primary">{stats.thisMonth}</span>
              <span className="text-sm font-medium text-on-surface-variant">Adjustments created</span>
            </div>
          </div>
          <div className="flex h-40 flex-col justify-between rounded-xl border-l-4 border-primary bg-surface-container p-6">
            <span className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">All time (loaded)</span>
            <div className="flex items-end justify-between">
              <span className="font-manrope text-4xl font-extrabold text-on-surface">{stats.total}</span>
              <span className="text-sm text-on-surface-variant">Rows in list</span>
            </div>
          </div>
          <div className="flex h-40 flex-col justify-between rounded-xl bg-tertiary-fixed-dim/20 p-6">
            <span className="text-sm font-bold uppercase tracking-widest text-on-tertiary-fixed">Awaiting approver</span>
            <div className="flex items-end justify-between">
              <span className="font-manrope text-4xl font-extrabold text-on-tertiary-fixed">{String(stats.pending).padStart(2, "0")}</span>
              <span className="text-sm font-medium text-on-tertiary-fixed">No approved_by</span>
            </div>
          </div>
        </div>
      </main>

      <button
        type="button"
        onClick={() => setCreateModalOpen(true)}
        className="group fixed bottom-[72px] right-8 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-2xl transition-transform hover:scale-110 active:scale-95 md:bottom-8"
        aria-label="Create request"
      >
        <span className="material-symbols-outlined text-2xl transition-transform group-hover:rotate-90">add</span>
      </button>

      <CreateDisposalRequestModal open={createModalOpen} onClose={closeCreateModal} profile={profile} locations={modalLocations} />

      <nav className="fixed bottom-0 left-0 right-0 z-50 w-full rounded-t-3xl border-t border-slate-100 bg-white/90 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] backdrop-blur-lg dark:border-slate-800 dark:bg-slate-950/90 md:hidden">
        <div className="flex w-full items-center justify-around px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Link
            to="/"
            className="flex flex-col items-center justify-center font-label text-[10px] font-medium text-slate-400 transition-transform duration-200 active:scale-95 dark:text-slate-500"
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span>Home</span>
          </Link>
          <Link
            to="/inventory"
            className="flex flex-col items-center justify-center font-label text-[10px] font-medium text-slate-400 transition-transform duration-200 active:scale-95 dark:text-slate-500"
          >
            <span className="material-symbols-outlined">inventory_2</span>
            <span>Inventory</span>
          </Link>
          <div className="flex flex-col items-center justify-center rounded-2xl bg-blue-50 px-5 py-2 font-label text-[10px] font-medium text-blue-700 transition-transform duration-200 active:scale-95 dark:bg-blue-900/30 dark:text-blue-300">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              delete_sweep
            </span>
            <span>Dispose</span>
          </div>
          <Link
            to="/count"
            className="flex flex-col items-center justify-center font-label text-[10px] font-medium text-slate-400 transition-transform duration-200 active:scale-95 dark:text-slate-500"
          >
            <span className="material-symbols-outlined">fact_check</span>
            <span>Count</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
