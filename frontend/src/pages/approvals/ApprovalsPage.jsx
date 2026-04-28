import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { NotificationBell } from "../../components/NotificationBell";
import { UserAvatarOrIcon } from "../../components/UserAvatarOrIcon";

const TABS = [
  { key: "all", label: "All" },
  { key: "purchase_orders", label: "Purchase Orders" },
  { key: "receive_items", label: "Receive Items" },
  { key: "transfer_requests", label: "Transfer Requests" },
  { key: "deliveries", label: "Deliveries" },
  { key: "stock_counts", label: "Stock Counts" },
  { key: "disposal_requests", label: "Disposal Requests" },
];

const TYPE_LABEL = {
  purchase_orders: "Purchase Order",
  receive_items: "Receive Item",
  transfer_requests: "Transfer Request",
  deliveries: "Delivery",
  stock_counts: "Stock Count",
  disposal_requests: "Disposal Request",
};

function profileLabel(profile) {
  if (!profile) return "Inventory user";
  const firstName = String(profile.first_name || "").trim();
  const lastName = String(profile.last_name || "").trim();
  if (firstName || lastName) return [firstName, lastName].filter(Boolean).join(" ");
  return profile.email || "Inventory user";
}

function profileRoleLabel(profile) {
  const roleNode = Array.isArray(profile?.roles) ? profile.roles[0] : profile?.roles;
  return String(roleNode?.name || "").trim();
}

function profileLabelWithRole(profile) {
  const base = profileLabel(profile);
  const roleName = profileRoleLabel(profile);
  if (!roleName) return base;
  return `${base} (${roleName})`;
}

function whoRequested(row) {
  if (!row) return "—";
  if (row.requestedBy && String(row.requestedBy).trim()) return row.requestedBy;
  if (row.createdBy && String(row.createdBy).trim()) return row.createdBy;
  return "—";
}

function formatDate(raw) {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function formatDateOnly(raw) {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function asPendingLabel(rawStatus) {
  const s = String(rawStatus || "").toLowerCase();
  if (s === "sent") return "Pending Approval";
  if (s.includes("pending")) return "Pending Approval";
  if (s === "requested") return "Requested";
  if (s === "completed") return "Completed";
  if (s === "discrepancies_found") return "Discrepancies Found";
  if (s === "scheduled") return "Scheduled";
  return rawStatus || "Pending Approval";
}

function toAttachmentUrls(paths) {
  if (!Array.isArray(paths)) return [];
  return paths
    .map((path) => {
      const p = String(path || "").trim();
      if (!p) return null;
      const { data } = supabase.storage.from("attachments").getPublicUrl(p);
      return data?.publicUrl || null;
    })
    .filter(Boolean);
}

export default function ApprovalsPage() {
  const { profile, role } = useAuth();
  const [activeTab, setActiveTab] = useState("all");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [rejectTargetRow, setRejectTargetRow] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const loadApprovals = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [poRes, receiveRes, transferRes, deliveryRes, countRes, disposeRes] = await Promise.all([
        supabase
          .from("purchase_orders")
          .select("id,po_number,status,created_at,created_by,profiles!purchase_orders_created_by_fkey(first_name,last_name,email)")
          .eq("status", "sent")
          .order("created_at", { ascending: false })
          .limit(60),
        supabase
          .from("receive_transactions")
          .select("id,transaction_number,status,created_at,supplier_name,received_by_text,created_by")
          .eq("status", "pending_approval")
          .order("created_at", { ascending: false })
          .limit(60),
        supabase
          .from("stock_transfers")
          .select("id,transfer_number,status,created_at,from_location,to_location,created_by,profiles!stock_transfers_created_by_fkey(first_name,last_name,email)")
          .in("status", ["pending", "requested"])
          .order("created_at", { ascending: false })
          .limit(60),
        supabase
          .from("delivery_requests")
          .select("id,reference_no,status,created_at,customer_name,created_by")
          .eq("status", "pending_approval")
          .order("created_at", { ascending: false })
          .limit(60),
        supabase
          .from("stock_counts")
          .select("id,count_number,status,created_at,location,created_by")
          .in("status", ["completed", "discrepancies_found"])
          .order("created_at", { ascending: false })
          .limit(60),
        supabase
          .from("stock_adjustments")
          .select("id,adjustment_number,status,created_at,adjustment_type,reason,created_by,creator:profiles!stock_adjustments_created_by_fkey(first_name,last_name,email)")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(60),
      ]);

      const nextRows = [];

      if (!poRes.error && Array.isArray(poRes.data)) {
        nextRows.push(
          ...poRes.data.map((row) => ({
            id: row.id,
            type: "purchase_orders",
            referenceNo: row.po_number || "—",
            requestedBy: profileLabel(Array.isArray(row.profiles) ? row.profiles[0] : row.profiles),
            createdBy: row.created_by || null,
            date: row.created_at,
            status: row.status || "pending",
            raw: row,
          }))
        );
      }

      if (!receiveRes.error && Array.isArray(receiveRes.data)) {
        nextRows.push(
          ...receiveRes.data.map((row) => ({
            id: row.id,
            type: "receive_items",
            referenceNo: row.transaction_number || "—",
            requestedBy: row.received_by_text || "—",
            createdBy: row.created_by || null,
            date: row.created_at,
            status: row.status || "pending_approval",
            raw: row,
          }))
        );
      }

      if (!transferRes.error && Array.isArray(transferRes.data)) {
        nextRows.push(
          ...transferRes.data.map((row) => ({
            id: row.id,
            type: "transfer_requests",
            referenceNo: row.transfer_number || "—",
            requestedBy: profileLabel(Array.isArray(row.profiles) ? row.profiles[0] : row.profiles),
            createdBy: row.created_by || null,
            date: row.created_at,
            status: row.status || "pending",
            raw: row,
          }))
        );
      }

      if (!deliveryRes.error && Array.isArray(deliveryRes.data)) {
        nextRows.push(
          ...deliveryRes.data.map((row) => ({
            id: row.id,
            type: "deliveries",
            referenceNo: row.reference_no || "—",
            requestedBy: row.customer_name || "—",
            createdBy: row.created_by || null,
            date: row.created_at,
            status: row.status || "pending_approval",
            raw: row,
          }))
        );
      }

      if (!countRes.error && Array.isArray(countRes.data)) {
        nextRows.push(
          ...countRes.data.map((row) => ({
            id: row.id,
            type: "stock_counts",
            referenceNo: row.count_number || "—",
            requestedBy: row.location || "—",
            createdBy: row.created_by || null,
            date: row.created_at,
            status: row.status || "completed",
            raw: row,
          }))
        );
      }

      if (!disposeRes.error && Array.isArray(disposeRes.data)) {
        nextRows.push(
          ...disposeRes.data.map((row) => ({
            id: row.id,
            type: "disposal_requests",
            referenceNo: row.adjustment_number || "—",
            requestedBy: profileLabel(Array.isArray(row.creator) ? row.creator[0] : row.creator),
            createdBy: row.created_by || null,
            date: row.created_at,
            status: row.status || "pending",
            raw: row,
          }))
        );
      }

      const creatorIds = [...new Set(nextRows.map((row) => row.createdBy).filter(Boolean))];
      let profileById = new Map();
      if (creatorIds.length > 0) {
        const { data: profileRows, error: profileErr } = await supabase
          .from("profiles")
          .select("id,first_name,last_name,email,roles(name)")
          .in("id", creatorIds);
        if (!profileErr && Array.isArray(profileRows)) {
          profileById = new Map(profileRows.map((row) => [row.id, row]));
        }
      }

      const withRequester = nextRows.map((row) => {
        const creatorProfile = row.createdBy ? profileById.get(row.createdBy) : null;
        if (creatorProfile) {
          return {
            ...row,
            requestedBy: profileLabelWithRole(creatorProfile),
          };
        }
        return row;
      });

      setRows(withRequester.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()));
    } catch (e) {
      setError(e?.message || "Unable to load approvals.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshDetails = useCallback(async (row) => {
    if (!row) return;
    setDetailsLoading(true);
    try {
      if (row.type === "receive_items") {
        const [headerRes, itemsRes] = await Promise.all([
          supabase
            .from("receive_transactions")
            .select("id,transaction_number,supplier_name,location,received_by_text,received_date,remarks,attachment_path,status,created_at")
            .eq("id", row.id)
            .single(),
          supabase
            .from("receive_transaction_items")
            .select("id,sku,item_name,description,unit_of_measure,quantity,issue_quantity,location,condition_tag")
            .eq("receive_transaction_id", row.id)
            .order("created_at", { ascending: true }),
        ]);
        if (headerRes.error) throw headerRes.error;
        if (itemsRes.error) throw itemsRes.error;
        setSelectedDetails({
          header: headerRes.data,
          items: itemsRes.data || [],
        });
        return;
      }

      if (row.type === "disposal_requests") {
        let { data, error: detailErr } = await supabase
          .from("stock_adjustments")
          .select("id,adjustment_number,adjustment_type,quantity,reason,requested_location,status,created_at,review_notes,attachment_paths")
          .eq("id", row.id)
          .single();
        if (detailErr) {
          const fallbackRes = await supabase
            .from("stock_adjustments")
            .select("id,adjustment_number,adjustment_type,quantity,reason,requested_location,status,created_at,review_notes")
            .eq("id", row.id)
            .single();
          data = fallbackRes.data;
          detailErr = fallbackRes.error;
        }
        if (detailErr) throw detailErr;
        setSelectedDetails({
          header: data,
          items: [],
        });
        return;
      }

      if (row.type === "deliveries") {
        const [headerRes, itemsRes] = await Promise.all([
          supabase
            .from("delivery_requests")
            .select("id,reference_no,customer_name,delivery_date,tracking_number,delivery_confirmation,attachment_path,status,created_at")
            .eq("id", row.id)
            .single(),
          supabase
            .from("delivery_request_items")
            .select("id,sku,item_name,quantity,unit_of_measure,from_location,to_location")
            .eq("delivery_request_id", row.id)
            .order("created_at", { ascending: true }),
        ]);
        if (headerRes.error) throw headerRes.error;
        if (itemsRes.error) throw itemsRes.error;
        setSelectedDetails({ header: headerRes.data, items: itemsRes.data || [] });
        return;
      }

      if (row.type === "stock_counts") {
        const [headerRes, itemsRes] = await Promise.all([
          supabase
            .from("stock_counts")
            .select("id,count_number,location,status,created_at,notes")
            .eq("id", row.id)
            .single(),
          supabase
            .from("stock_count_items")
            .select("id,system_quantity,counted_quantity,variance,notes,item:inventory_items(name,sku)")
            .eq("count_id", row.id),
        ]);
        if (headerRes.error) throw headerRes.error;
        if (itemsRes.error) throw itemsRes.error;
        setSelectedDetails({ header: headerRes.data, items: itemsRes.data || [] });
        return;
      }

      if (row.type === "purchase_orders") {
        const { data, error: detailErr } = await supabase
          .from("purchase_orders")
          .select(
            "id,po_number,status,created_at,expected_delivery_date,notes,total_amount,suppliers(name),purchase_order_items(id,item_id,quantity_ordered,quantity_received,unit_price,inventory_items(name,sku,unit_of_measure))"
          )
          .eq("id", row.id)
          .single();
        if (detailErr) throw detailErr;
        setSelectedDetails({
          header: data,
          items: data?.purchase_order_items || [],
        });
        return;
      }

      if (row.type === "transfer_requests") {
        const [headerRes, itemsRes] = await Promise.all([
          supabase
            .from("stock_transfers")
            .select("id,transfer_number,from_location,to_location,status,notes,created_at")
            .eq("id", row.id)
            .single(),
          supabase
            .from("stock_transfer_items")
            .select("id,item_id,quantity,inventory_items(name,sku,unit_of_measure)")
            .eq("transfer_id", row.id)
            .order("created_at", { ascending: true }),
        ]);
        if (headerRes.error) throw headerRes.error;
        if (itemsRes.error) throw itemsRes.error;
        setSelectedDetails({ header: headerRes.data, items: itemsRes.data || [] });
        return;
      }

      setSelectedDetails({ header: row.raw || {}, items: [] });
    } catch (e) {
      setSelectedDetails({
        header: { error: e?.message || "Failed to load details." },
        items: [],
      });
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadApprovals();
  }, [loadApprovals]);

  const filteredRows = useMemo(() => {
    if (activeTab === "all") return rows;
    return rows.filter((row) => row.type === activeTab);
  }, [rows, activeTab]);

  const handleView = useCallback(
    async (row) => {
      setSelectedRow(row);
      setSelectedDetails(null);
      await refreshDetails(row);
    },
    [refreshDetails]
  );

  const handleReview = useCallback(
    async (row, action, reviewNotes = "") => {
      const key = `${row.id}:${action}`;
      setBusyKey(key);
      try {
        if (row.type === "receive_items") {
          const { error: rpcErr } = await supabase.rpc("process_receive_transaction_review", {
            p_receive_transaction_id: row.id,
            p_action: action,
            p_review_notes: String(reviewNotes || "").trim() || null,
          });
          if (rpcErr) throw rpcErr;
        } else if (row.type === "disposal_requests") {
          const note = String(reviewNotes || "").trim();
          if (action === "reject" && !note) throw new Error("Rejection reason is required.");
          const { error: rpcErr } = await supabase.rpc("process_stock_adjustment_review", {
            p_adjustment_id: row.id,
            p_action: action,
            p_review_notes: note || null,
          });
          if (rpcErr) throw rpcErr;
        } else if (row.type === "purchase_orders") {
          const nextStatus = action === "approve" ? "confirmed" : "cancelled";
          const { error: updateErr } = await supabase
            .from("purchase_orders")
            .update({ status: nextStatus })
            .eq("id", row.id);
          if (updateErr) throw updateErr;
        } else if (row.type === "transfer_requests") {
          if (action === "approve") {
            const [transferRes, itemRes] = await Promise.all([
              supabase
                .from("stock_transfers")
                .select("id,transfer_number,from_location,to_location,status")
                .eq("id", row.id)
                .single(),
              supabase
                .from("stock_transfer_items")
                .select("item_id,quantity")
                .eq("transfer_id", row.id),
            ]);
            if (transferRes.error) throw transferRes.error;
            if (itemRes.error) throw itemRes.error;
            const transfer = transferRes.data;
            if (!transfer || (String(transfer.status || "").toLowerCase() !== "pending" && String(transfer.status || "").toLowerCase() !== "requested")) {
              throw new Error("Transfer is no longer pending approval or requested.");
            }
            const movements = [];
            for (const item of itemRes.data || []) {
              const qty = Number(item.quantity || 0);
              if (!item.item_id || !Number.isFinite(qty) || qty <= 0) continue;
              movements.push(
                {
                  item_id: item.item_id,
                  movement_type: "out",
                  reference_type: "transfer",
                  reference_id: transfer.id,
                  quantity: qty,
                  from_location: transfer.from_location,
                  to_location: transfer.to_location,
                  notes: `Transfer out (${transfer.transfer_number})`,
                  created_by: profile?.id || null,
                },
                {
                  item_id: item.item_id,
                  movement_type: "in",
                  reference_type: "transfer",
                  reference_id: transfer.id,
                  quantity: qty,
                  from_location: transfer.from_location,
                  to_location: transfer.to_location,
                  notes: `Transfer in (${transfer.transfer_number})`,
                  created_by: profile?.id || null,
                }
              );
            }
            if (movements.length > 0) {
              const { error: moveErr } = await supabase.from("stock_movements").insert(movements);
              if (moveErr) throw moveErr;
            }
            const { error: updateErr } = await supabase
              .from("stock_transfers")
              .update({ status: "completed" })
              .eq("id", row.id);
            if (updateErr) throw updateErr;
          } else {
            const { error: updateErr } = await supabase
              .from("stock_transfers")
              .update({ status: "cancelled" })
              .eq("id", row.id);
            if (updateErr) throw updateErr;
          }
        } else if (row.type === "deliveries") {
          const isReject = action === "reject";
          const note = String(reviewNotes || "").trim();
          if (isReject && !note) throw new Error("Rejection reason is required.");

          if (action === "approve") {
            const [headerRes, itemsRes] = await Promise.all([
              supabase
                .from("delivery_requests")
                .select("id,reference_no,status")
                .eq("id", row.id)
                .single(),
              supabase
                .from("delivery_request_items")
                .select("item_id,quantity,from_location,to_location,sku,item_name,unit_of_measure")
                .eq("delivery_request_id", row.id),
            ]);
            if (headerRes.error) throw headerRes.error;
            if (itemsRes.error) throw itemsRes.error;
            const delivery = headerRes.data;
            if (!delivery || String(delivery.status || "").toLowerCase() !== "pending_approval") {
              throw new Error("Delivery is no longer pending approval.");
            }

            const movements = [];
            for (const item of itemsRes.data || []) {
              const qtyRaw = Number(item.quantity ?? 0);
              if (!item.item_id || !Number.isFinite(qtyRaw) || qtyRaw <= 0) continue;
              if (!Number.isInteger(qtyRaw)) {
                throw new Error(`Delivery quantity for ${item.sku || item.item_name || "item"} must be a whole number.`);
              }
              movements.push({
                item_id: item.item_id,
                movement_type: "out",
                reference_type: "sale",
                reference_id: delivery.id,
                quantity: qtyRaw,
                from_location: item.from_location || null,
                to_location: item.to_location || null,
                notes: `Delivery out (${delivery.reference_no})`,
                created_by: profile?.id || null,
              });
            }

            if (movements.length > 0) {
              const { error: moveErr } = await supabase.from("stock_movements").insert(movements);
              if (moveErr) throw moveErr;
            }

            const { error: updateErr } = await supabase
              .from("delivery_requests")
              .update({
                status: "scheduled",
                reviewed_by: profile?.id || null,
                reviewed_at: new Date().toISOString(),
                review_notes: null,
              })
              .eq("id", row.id);
            if (updateErr) throw updateErr;
          } else {
            const { error: updateErr } = await supabase
              .from("delivery_requests")
              .update({
                status: "cancelled",
                reviewed_by: profile?.id || null,
                reviewed_at: new Date().toISOString(),
                review_notes: note || null,
              })
              .eq("id", row.id);
            if (updateErr) throw updateErr;
          }
        } else if (row.type === "stock_counts") {
          const isReject = action === "reject";
          const note = String(reviewNotes || "").trim();
          if (isReject && !note) throw new Error("Reason is required.");
          const fallbackNote =
            action === "approve"
              ? `Approved from approvals page by ${profile?.id || "system"}`
              : note;
          const { error: rpcErr } = await supabase.rpc("process_stock_count_review", {
            p_count_id: row.id,
            p_action: action,
            p_review_notes: fallbackNote || "No review notes",
          });
          if (rpcErr) throw rpcErr;
        } else {
          window.alert(`Approval action for ${TYPE_LABEL[row.type]} is not wired yet.`);
          return;
        }

        await loadApprovals();
        if (selectedRow?.id === row.id) {
          setSelectedRow(null);
          setSelectedDetails(null);
        }
      } catch (e) {
        window.alert(`Failed to ${action} request: ${e?.message || e}`);
      } finally {
        setBusyKey("");
      }
    },
    [loadApprovals, profile?.id, selectedRow?.id]
  );

  return (
    <div className="min-h-dvh bg-surface text-on-surface selection:bg-primary-fixed selection:text-on-primary-fixed pb-20 md:pb-0">
      <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-white/80 shadow-sm shadow-blue-900/5 backdrop-blur-xl dark:bg-slate-900/80">
        <div className="mx-auto flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8 max-w-[1440px]">
          <div className="flex items-center gap-6 min-w-0">
            <Link
              to="/dashboard"
              className="text-xl font-bold tracking-tighter text-slate-900 transition-opacity hover:opacity-90 dark:text-white font-headline"
            >
              Inventory
            </Link>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 lg:gap-6 min-w-0">
            <NotificationBell />
            {role ? (
              <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                {role}
              </span>
            ) : null}
            <span className="shrink-0 rounded-full border-2 border-surface-bright bg-surface-container-high p-0">
              <UserAvatarOrIcon src={profile?.avatar_url} alt={profileLabel(profile)} size="md" />
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-2 pb-3 pt-[4.4rem] sm:px-3 lg:px-4 md:pb-2">
        <section className="px-1 py-2 sm:px-2">
          <div className="relative mx-auto h-[calc(100dvh-5.8rem)] w-full overflow-hidden rounded-[2rem] border border-outline-variant/15 bg-gradient-to-b from-surface-container-lowest to-surface shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
            <Link
              to="/dashboard"
              className="absolute right-5 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/20 bg-white/90 text-on-surface-variant shadow-sm transition-all hover:border-error/20 hover:bg-white hover:text-error"
              aria-label="Close approvals page"
              title="Close"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </Link>

            <div className="grid h-full grid-cols-1 lg:grid-cols-[210px_minmax(0,1fr)]">
              <aside className="border-b border-outline-variant/10 bg-white/55 p-3 backdrop-blur-sm lg:border-b-0 lg:border-r">
                <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-primary/60">Approval Filters</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
                  {TABS.map((tab) => {
                    const active = activeTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={`w-full rounded-[0.9rem] border px-2.5 py-2 text-left transition-all ${
                          active
                            ? "border-primary/25 bg-white text-primary shadow-[0_12px_28px_rgba(59,130,246,0.12)]"
                            : "border-slate-200/70 bg-white/85 text-on-surface shadow-[0_8px_24px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_14px_30px_rgba(59,130,246,0.10)]"
                        }`}
                      >
                        <span className="block text-[11px] font-semibold leading-tight tracking-wide truncate">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <div className="min-h-0 overflow-auto p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h1 className="text-xl font-extrabold tracking-tight font-headline">Approvals</h1>
                  </div>
                </div>

                {error ? (
                  <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
                ) : null}

                <div className="overflow-auto rounded-2xl border border-outline-variant/20">
                  <table className="min-w-full text-left">
                    <thead className="bg-surface-container-low">
                      <tr className="text-[11px] uppercase tracking-[0.12em] text-on-surface-variant">
                        <th className="px-3 py-2.5 font-bold whitespace-nowrap">Reference No</th>
                        <th className="px-3 py-2.5 font-bold whitespace-nowrap">Type</th>
                        <th className="px-3 py-2.5 font-bold whitespace-nowrap">Requested By</th>
                        <th className="px-3 py-2.5 font-bold whitespace-nowrap">Date</th>
                        <th className="px-3 py-2.5 font-bold whitespace-nowrap">Status</th>
                        <th className="px-3 py-2.5 font-bold whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/15 bg-white">
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-5 text-sm text-on-surface-variant">
                            Loading approvals...
                          </td>
                        </tr>
                      ) : filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-5 text-sm text-on-surface-variant">
                            No pending approvals found for this tab.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((row) => {
                          const reviewEnabled =
                            row.type === "receive_items" ||
                            row.type === "disposal_requests" ||
                            row.type === "purchase_orders" ||
                            row.type === "transfer_requests" ||
                            row.type === "deliveries" ||
                            row.type === "stock_counts";
                          return (
                            <tr key={`${row.type}:${row.id}`} className="hover:bg-surface-container-low/30">
                              <td className="px-3 py-2.5 text-sm font-semibold text-on-surface whitespace-nowrap">{row.referenceNo}</td>
                              <td className="px-3 py-2.5 text-sm text-on-surface-variant whitespace-nowrap">{TYPE_LABEL[row.type] || row.type}</td>
                              <td className="px-3 py-2.5 text-sm text-on-surface-variant max-w-[220px] truncate whitespace-nowrap" title={whoRequested(row)}>{whoRequested(row)}</td>
                              <td className="px-3 py-2.5 text-sm text-on-surface-variant whitespace-nowrap">{formatDate(row.date)}</td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-700 whitespace-nowrap">
                                  {asPendingLabel(row.status)}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => void handleView(row)}
                                    className="rounded-full border border-outline-variant/30 px-2.5 py-1 text-[11px] font-semibold text-on-surface hover:border-primary/30"
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busyKey.length > 0 || !reviewEnabled}
                                    onClick={() => void handleReview(row, "approve")}
                                    className="rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busyKey.length > 0 || !reviewEnabled}
                    onClick={() => {
                      setRejectTargetRow(row);
                      setRejectReason("");
                    }}
                                    className="rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {selectedRow ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-outline-variant/20 bg-white p-4 shadow-2xl sm:p-6">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                  {TYPE_LABEL[selectedRow.type] || selectedRow.type}
                </p>
                <h2 className="text-lg font-extrabold text-on-surface">{selectedRow.referenceNo}</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedRow(null);
                  setSelectedDetails(null);
                }}
                className="rounded-full border border-outline-variant/30 p-2 text-on-surface-variant hover:text-on-surface"
                aria-label="Close details"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {detailsLoading ? (
              <p className="text-sm text-on-surface-variant">Loading details...</p>
            ) : (
              <div className="space-y-3 text-sm">
                {selectedDetails?.header?.error ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">{selectedDetails.header.error}</div>
                ) : null}

                {selectedRow.type === "receive_items" && selectedDetails?.header ? (
                  <div className="space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <p><span className="font-semibold">Supplier:</span> {selectedDetails.header.supplier_name || "—"}</p>
                      <p><span className="font-semibold">Location:</span> {selectedDetails.header.location || "—"}</p>
                      <p><span className="font-semibold">Received By:</span> {selectedDetails.header.received_by_text || "—"}</p>
                      <p><span className="font-semibold">Received Date:</span> {formatDate(selectedDetails.header.received_date)}</p>
                    </div>
                    <div className="overflow-auto rounded-xl border border-outline-variant/20">
                      <table className="min-w-full text-left">
                        <thead className="bg-surface-container-low">
                          <tr className="text-[11px] uppercase tracking-[0.1em] text-on-surface-variant">
                            <th className="px-3 py-2">Item</th>
                            <th className="px-3 py-2">SKU</th>
                            <th className="px-3 py-2">Qty</th>
                            <th className="px-3 py-2">Unit</th>
                            <th className="px-3 py-2">Location</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/15">
                          {(selectedDetails.items || []).map((item) => (
                            <tr key={item.id}>
                              <td className="px-3 py-2">{item.item_name || "—"}</td>
                              <td className="px-3 py-2">{item.sku || "—"}</td>
                              <td className="px-3 py-2">{item.quantity ?? 0}</td>
                              <td className="px-3 py-2">{item.unit_of_measure || "—"}</td>
                              <td className="px-3 py-2">{item.location || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p><span className="font-semibold">Attachments:</span> {selectedDetails.header.attachment_path || "—"}</p>
                    <p><span className="font-semibold">Remarks:</span> {selectedDetails.header.remarks || "—"}</p>
                  </div>
                ) : null}

                {selectedRow.type === "disposal_requests" && selectedDetails?.header ? (
                  <div className="space-y-3">
                    <div className="overflow-auto rounded-xl border border-outline-variant/20">
                      <table className="min-w-full text-left">
                        <thead className="bg-surface-container-low">
                          <tr className="text-[11px] uppercase tracking-[0.1em] text-on-surface-variant">
                            <th className="px-3 py-2">Adjustment Type</th>
                            <th className="px-3 py-2">Quantity</th>
                            <th className="px-3 py-2">Requested Location</th>
                            <th className="px-3 py-2">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/15">
                          <tr>
                            <td className="px-3 py-2">{selectedDetails.header.adjustment_type || "—"}</td>
                            <td className="px-3 py-2">{selectedDetails.header.quantity ?? 0}</td>
                            <td className="px-3 py-2">{selectedDetails.header.requested_location || "—"}</td>
                            <td className="px-3 py-2">{formatDate(selectedDetails.header.created_at)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p><span className="font-semibold">Reason:</span> {selectedDetails.header.reason || "—"}</p>
                    {Array.isArray(selectedDetails.header.attachment_paths) &&
                    selectedDetails.header.attachment_paths.length > 0 ? (
                      <div className="space-y-2">
                        <p><span className="font-semibold">Attachments:</span></p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {toAttachmentUrls(selectedDetails.header.attachment_paths).map((url) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="block overflow-hidden rounded-lg border border-outline-variant/20 bg-surface-container-low"
                            >
                              <img src={url} alt="Disposal attachment" className="h-24 w-full object-cover" />
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {selectedRow.type === "deliveries" && selectedDetails?.header ? (
                  <div className="space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <p><span className="font-semibold">Customer:</span> {selectedDetails.header.customer_name || "—"}</p>
                      <p><span className="font-semibold">Delivery Date:</span> {formatDate(selectedDetails.header.delivery_date)}</p>
                      <p><span className="font-semibold">Tracking No:</span> {selectedDetails.header.tracking_number || "—"}</p>
                      <p><span className="font-semibold">Confirmation:</span> {selectedDetails.header.delivery_confirmation || "—"}</p>
                    </div>
                    <div className="overflow-auto rounded-xl border border-outline-variant/20">
                      <table className="min-w-full text-left">
                        <thead className="bg-surface-container-low">
                          <tr className="text-[11px] uppercase tracking-[0.1em] text-on-surface-variant">
                            <th className="px-3 py-2">SKU</th>
                            <th className="px-3 py-2">Item</th>
                            <th className="px-3 py-2">Qty</th>
                            <th className="px-3 py-2">From</th>
                            <th className="px-3 py-2">To</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/15">
                          {(selectedDetails.items || []).map((item) => (
                            <tr key={item.id}>
                              <td className="px-3 py-2">{item.sku || "—"}</td>
                              <td className="px-3 py-2">{item.item_name || "—"}</td>
                              <td className="px-3 py-2">{item.quantity ?? 0} {item.unit_of_measure || ""}</td>
                              <td className="px-3 py-2">{item.from_location || "—"}</td>
                              <td className="px-3 py-2">{item.to_location || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {selectedRow.type === "stock_counts" && selectedDetails?.header ? (
                  <div className="space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <p><span className="font-semibold">Count No:</span> {selectedDetails.header.count_number || "—"}</p>
                      <p><span className="font-semibold">Location:</span> {selectedDetails.header.location || "—"}</p>
                      <p><span className="font-semibold">Status:</span> {asPendingLabel(selectedDetails.header.status)}</p>
                      <p><span className="font-semibold">Date:</span> {formatDate(selectedDetails.header.created_at)}</p>
                    </div>
                    <div className="overflow-auto rounded-xl border border-outline-variant/20">
                      <table className="min-w-full text-left">
                        <thead className="bg-surface-container-low">
                          <tr className="text-[11px] uppercase tracking-[0.1em] text-on-surface-variant">
                            <th className="px-3 py-2">Item</th>
                            <th className="px-3 py-2">SKU</th>
                            <th className="px-3 py-2">System</th>
                            <th className="px-3 py-2">Counted</th>
                            <th className="px-3 py-2">Variance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/15">
                          {(selectedDetails.items || []).map((item) => (
                            <tr key={item.id}>
                              <td className="px-3 py-2">{item.item?.name || "—"}</td>
                              <td className="px-3 py-2">{item.item?.sku || "—"}</td>
                              <td className="px-3 py-2">{item.system_quantity ?? 0}</td>
                              <td className="px-3 py-2">{item.counted_quantity ?? 0}</td>
                              <td className="px-3 py-2">{item.variance ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {selectedRow.type === "purchase_orders" && selectedDetails?.header ? (
                  <div className="space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <p><span className="font-semibold">PO Number:</span> {selectedDetails.header.po_number || "—"}</p>
                      <p><span className="font-semibold">Supplier:</span> {selectedDetails.header.suppliers?.name || "—"}</p>
                      <p><span className="font-semibold">Expected Delivery:</span> {formatDateOnly(selectedDetails.header.expected_delivery_date)}</p>
                      <p><span className="font-semibold">Created:</span> {formatDate(selectedDetails.header.created_at)}</p>
                      <p><span className="font-semibold">Status:</span> {asPendingLabel(selectedDetails.header.status)}</p>
                      <p><span className="font-semibold">Total:</span> {selectedDetails.header.total_amount ?? 0}</p>
                    </div>
                    <div className="overflow-auto rounded-xl border border-outline-variant/20">
                      <table className="min-w-full text-left">
                        <thead className="bg-surface-container-low">
                          <tr className="text-[11px] uppercase tracking-[0.1em] text-on-surface-variant">
                            <th className="px-3 py-2">SKU</th>
                            <th className="px-3 py-2">Item</th>
                            <th className="px-3 py-2">Ordered</th>
                            <th className="px-3 py-2">Received</th>
                            <th className="px-3 py-2">Unit</th>
                            <th className="px-3 py-2">Unit Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/15">
                          {(selectedDetails.items || []).map((item) => (
                            <tr key={item.id}>
                              <td className="px-3 py-2">{item.inventory_items?.sku || "—"}</td>
                              <td className="px-3 py-2">{item.inventory_items?.name || "—"}</td>
                              <td className="px-3 py-2">{item.quantity_ordered ?? 0}</td>
                              <td className="px-3 py-2">{item.quantity_received ?? 0}</td>
                              <td className="px-3 py-2">{item.inventory_items?.unit_of_measure || "—"}</td>
                              <td className="px-3 py-2">{item.unit_price ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p><span className="font-semibold">Notes:</span> {selectedDetails.header.notes || "—"}</p>
                  </div>
                ) : null}

                {selectedRow.type === "transfer_requests" && selectedDetails?.header ? (
                  <div className="space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <p><span className="font-semibold">Transfer No:</span> {selectedDetails.header.transfer_number || "—"}</p>
                      <p><span className="font-semibold">Status:</span> {asPendingLabel(selectedDetails.header.status)}</p>
                      <p><span className="font-semibold">From:</span> {selectedDetails.header.from_location || "—"}</p>
                      <p><span className="font-semibold">To:</span> {selectedDetails.header.to_location || "—"}</p>
                      <p><span className="font-semibold">Created:</span> {formatDate(selectedDetails.header.created_at)}</p>
                    </div>
                    <div className="overflow-auto rounded-xl border border-outline-variant/20">
                      <table className="min-w-full text-left">
                        <thead className="bg-surface-container-low">
                          <tr className="text-[11px] uppercase tracking-[0.1em] text-on-surface-variant">
                            <th className="px-3 py-2">SKU</th>
                            <th className="px-3 py-2">Item</th>
                            <th className="px-3 py-2">Qty</th>
                            <th className="px-3 py-2">Unit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/15">
                          {(selectedDetails.items || []).map((item) => (
                            <tr key={item.id}>
                              <td className="px-3 py-2">{item.inventory_items?.sku || "—"}</td>
                              <td className="px-3 py-2">{item.inventory_items?.name || "—"}</td>
                              <td className="px-3 py-2">{item.quantity ?? 0}</td>
                              <td className="px-3 py-2">{item.inventory_items?.unit_of_measure || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p><span className="font-semibold">Notes:</span> {selectedDetails.header.notes || "—"}</p>
                  </div>
                ) : null}

                {selectedRow.type !== "receive_items" &&
                selectedRow.type !== "disposal_requests" &&
                selectedRow.type !== "deliveries" &&
                selectedRow.type !== "stock_counts" &&
                selectedRow.type !== "purchase_orders" &&
                selectedRow.type !== "transfer_requests" ? (
                  <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-on-surface-variant">
                    Details are not yet configured for this approval type.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {rejectTargetRow ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-outline-variant/20 bg-white p-4 shadow-2xl sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">Reject Request</p>
                <h3 className="text-lg font-extrabold text-on-surface">{rejectTargetRow.referenceNo}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRejectTargetRow(null);
                  setRejectReason("");
                }}
                className="rounded-full border border-outline-variant/30 p-2 text-on-surface-variant hover:text-on-surface"
                aria-label="Close reject reason modal"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
              Reason for rejection
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-sm text-on-surface focus:border-primary/40 focus:outline-none"
              placeholder="Type the reason why this request is rejected..."
            />

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectTargetRow(null);
                  setRejectReason("");
                }}
                className="rounded-full border border-outline-variant/30 px-4 py-1.5 text-xs font-semibold text-on-surface hover:border-primary/30"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyKey.length > 0 || !String(rejectReason || "").trim()}
                onClick={async () => {
                  const reason = String(rejectReason || "").trim();
                  if (!reason) return;
                  const row = rejectTargetRow;
                  setRejectTargetRow(null);
                  setRejectReason("");
                  await handleReview(row, "reject", reason);
                }}
                className="rounded-full bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
