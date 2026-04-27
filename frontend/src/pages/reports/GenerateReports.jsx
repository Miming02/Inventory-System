import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { NotificationBell } from "../../components/NotificationBell";
import { UserAvatarOrIcon } from "../../components/UserAvatarOrIcon";
import { supabase } from "../../lib/supabase";
import { getErrorMessage } from "../../lib/errors";

function profileDisplayName(profile) {
  if (!profile) return "Inventory user";
  const firstName = String(profile.first_name || "").trim();
  const lastName = String(profile.last_name || "").trim();
  if (firstName || lastName) return [firstName, lastName].filter(Boolean).join(" ");
  return profile.email || "Inventory user";
}

function historyStatusLabel(type, rawStatus) {
  const status = String(rawStatus || "").toLowerCase();
  if (type === "disposal") {
    if (status === "approved") return "Disposed";
    if (status === "rejected") return "Cancelled";
    if (status === "pending") return "Pending Approval";
    if (status === "draft") return "Draft";
  }
  if (type === "production") {
    if (status === "in_progress") return "In Progress";
    if (status === "completed") return "Completed";
    if (status === "failed") return "Failed";
  }
  if (!status) return "—";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractPoLocation(notes) {
  const text = String(notes || "");
  if (!text) return "—";
  const match = text.match(/(?:^|\n)\s*Location:\s*(.+)\s*(?:\n|$)/i);
  const value = String(match?.[1] || "").trim();
  return value || "—";
}

function sumBy(rows, key) {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((total, row) => total + Number(row?.[key] ?? 0), 0);
}

function compactLocations(values) {
  const unique = [...new Set((values || []).map((v) => String(v || "").trim()).filter(Boolean))];
  if (unique.length === 0) return "—";
  if (unique.length <= 2) return unique.join(", ");
  return `${unique.slice(0, 2).join(", ")} +${unique.length - 2}`;
}

function compactItemNames(rows) {
  const unique = [...new Set((rows || []).map((row) => row?.inventory_items?.name || row?.inventory_items?.sku).filter(Boolean))];
  if (unique.length === 0) return "";
  if (unique.length <= 2) return unique.join(", ");
  return `${unique.slice(0, 2).join(", ")} +${unique.length - 2}`;
}

function SidebarCard({ title, subtitle, icon, to, onClick, primary = false, active = false }) {
  const className = active
    ? "w-full rounded-[1.25rem] border border-primary/20 bg-white text-primary shadow-[0_12px_28px_rgba(59,130,246,0.12)] px-4 py-4 text-left transition-all"
    : "w-full rounded-[1.25rem] border border-slate-200/70 bg-white/85 text-on-surface shadow-[0_8px_24px_rgba(15,23,42,0.06)] px-4 py-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_14px_30px_rgba(59,130,246,0.10)]";

  const content = (
    <>
      <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      </span>
      <span className="block text-sm font-semibold leading-tight">{title}</span>
      {subtitle ? <span className="mt-1 block text-xs leading-5 text-on-surface-variant">{subtitle}</span> : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return (
    <Link to={to} className={className}>
      {content}
    </Link>
  );
}

export default function GenerateReports() {
  const { profile, role } = useAuth();
  const [activeView, setActiveView] = useState("home");
  const [reportType, setReportType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reportLocation, setReportLocation] = useState("");
  const [reportItem, setReportItem] = useState("");
  const [reportStatus, setReportStatus] = useState("");
  const [reportPage, setReportPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ total: 0, lowStock: 0 });
  const [inventoryBreakdownByItem, setInventoryBreakdownByItem] = useState({});
  const [expandedInventoryRows, setExpandedInventoryRows] = useState({});
  const [poSearch, setPoSearch] = useState("");
  const [poLoading, setPoLoading] = useState(true);
  const [poError, setPoError] = useState("");
  const [poRows, setPoRows] = useState([]);
  const [poPage, setPoPage] = useState(1);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [disposeLoading, setDisposeLoading] = useState(true);
  const [disposeError, setDisposeError] = useState("");
  const [disposeRows, setDisposeRows] = useState([]);
  const [disposeSearch, setDisposeSearch] = useState("");
  const [disposePage, setDisposePage] = useState(1);
  const [productionLoading, setProductionLoading] = useState(true);
  const [productionError, setProductionError] = useState("");
  const [productionRows, setProductionRows] = useState([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("all");
  const [historyPage, setHistoryPage] = useState(1);
  const [receiveRows, setReceiveRows] = useState([]);
  const [receiveLoading, setReceiveLoading] = useState(true);
  const [transferRows, setTransferRows] = useState([]);
  const [transferLoading, setTransferLoading] = useState(true);
  const [deliveryRows, setDeliveryRows] = useState([]);
  const [deliveryLoading, setDeliveryLoading] = useState(true);
  const [countRows, setCountRows] = useState([]);
  const [countLoading, setCountLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setLoadError("");
      const [listRes, totalRes, lowRes] = await Promise.all([
        supabase
          .from("inventory_items")
          .select("id,sku,name,item_type,current_stock,reorder_level,unit_of_measure,location,categories(name)")
          .neq("is_active", false)
          .order("name", { ascending: true })
          .limit(200),
        supabase.from("inventory_items").select("*", { count: "exact", head: true }).neq("is_active", false),
        supabase.from("inventory_items").select("*", { count: "exact", head: true }).neq("is_active", false).lte("current_stock", 20),
      ]);
      if (!active) return;
      if (listRes.error) {
        setLoadError(getErrorMessage(listRes.error));
        setRows([]);
        setInventoryBreakdownByItem({});
      } else {
        const list = listRes.data ?? [];
        setRows(list);
        const itemIds = list.map((row) => row.id).filter(Boolean);
        if (itemIds.length === 0) {
          setInventoryBreakdownByItem({});
        } else {
          const { data: locRows, error: locErr } = await supabase
            .from("inventory_item_locations")
            .select("item_id,location,quantity")
            .in("item_id", itemIds);
          if (locErr) {
            const fallback = {};
            for (const row of list) {
              if (row.location) {
                fallback[row.id] = [{ location: row.location, qty: Number(row.current_stock ?? 0) }];
              }
            }
            setInventoryBreakdownByItem(fallback);
          } else {
            const grouped = {};
            for (const loc of locRows ?? []) {
              const itemId = loc.item_id;
              if (!itemId) continue;
              if (!grouped[itemId]) grouped[itemId] = [];
              grouped[itemId].push({
                location: loc.location || "—",
                qty: Number(loc.quantity ?? 0),
              });
            }
            for (const itemId of Object.keys(grouped)) {
              grouped[itemId].sort((a, b) => b.qty - a.qty || String(a.location).localeCompare(String(b.location)));
            }
            setInventoryBreakdownByItem(grouped);
          }
        }
      }
      setStats({
        total: totalRes.error ? 0 : totalRes.count ?? 0,
        lowStock: lowRes.error ? 0 : lowRes.count ?? 0,
      });
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setCountLoading(true);
      const { data } = await supabase
        .from("stock_counts")
        .select("id,count_number,status,location,created_at,completed_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!active) return;
      setCountRows(data ?? []);
      setCountLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setReceiveLoading(true);
      const { data } = await supabase
        .from("receive_transactions")
        .select("id,transaction_number,status,location,created_at,supplier_name,remarks,receive_transaction_items(quantity,location)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!active) return;
      setReceiveRows(data ?? []);
      setReceiveLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setTransferLoading(true);
      const { data } = await supabase
        .from("stock_transfers")
        .select("id,transfer_number,status,from_location,to_location,created_at,stock_transfer_items(quantity)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!active) return;
      setTransferRows(data ?? []);
      setTransferLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setDeliveryLoading(true);
      const { data } = await supabase
        .from("delivery_requests")
        .select("id,reference_no,status,delivery_date,created_at,customer_name,delivery_request_items(quantity,from_location,to_location)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!active) return;
      setDeliveryRows(data ?? []);
      setDeliveryLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setProductionLoading(true);
      setProductionError("");
      const { data, error } = await supabase
        .from("production_runs")
        .select("id,production_number,status,target_quantity,output_unit,location,started_at,completed_at,failed_at,finished_good:inventory_items!production_runs_finished_good_item_id_fkey(name,sku)")
        .order("started_at", { ascending: false })
        .limit(200);
      if (!active) return;
      if (error) {
        setProductionError(getErrorMessage(error));
        setProductionRows([]);
      } else {
        setProductionRows(data ?? []);
      }
      setProductionLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setDisposeLoading(true);
      setDisposeError("");
      const { data, error } = await supabase
        .from("stock_adjustments")
        .select("id,adjustment_number,adjustment_type,quantity,status,created_at,requested_date,requested_location,inventory_items(name,sku)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!active) return;
      if (error) {
        setDisposeError(getErrorMessage(error));
        setDisposeRows([]);
      } else {
        setDisposeRows(data ?? []);
      }
      setDisposeLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setPoLoading(true);
      setPoError("");
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id,po_number,status,total_amount,created_at,expected_delivery_date,notes,suppliers(name),purchase_order_items(id,quantity_ordered,inventory_items(name,sku))")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!active) return;
      if (error) {
        setPoError(getErrorMessage(error));
        setPoRows([]);
      } else {
        setPoRows(data ?? []);
      }
      setPoLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const term = String(search || "").trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => {
      const blob = [row.name, row.sku, row.item_type, row?.categories?.name].join(" ").toLowerCase();
      return blob.includes(term);
    });
  }, [rows, search]);

  const filteredPoRows = useMemo(() => {
    const term = String(poSearch || "").trim().toLowerCase();
    if (!term) return poRows;
    return poRows.filter((row) => {
      const supplierName = row?.suppliers?.name ?? "";
      const blob = [row.po_number, supplierName, row.status].join(" ").toLowerCase();
      return blob.includes(term);
    });
  }, [poRows, poSearch]);

  const filteredDisposeRows = useMemo(() => {
    const term = String(disposeSearch || "").trim().toLowerCase();
    if (!term) return disposeRows;
    return disposeRows.filter((row) => {
      const itemName = row?.inventory_items?.name ?? "";
      const itemSku = row?.inventory_items?.sku ?? "";
      const blob = [row.adjustment_number, row.adjustment_type, row.status, itemName, itemSku, row.requested_location].join(" ").toLowerCase();
      return blob.includes(term);
    });
  }, [disposeRows, disposeSearch]);

  const poStats = useMemo(() => {
    const pending = poRows.filter((row) => String(row.status || "").toLowerCase() === "pending").length;
    const inTransit = poRows.filter((row) => {
      const status = String(row.status || "").toLowerCase();
      return status === "in_transit" || status === "in transit";
    }).length;
    const totalValue = poRows.reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);
    return { total: poRows.length, pending, inTransit, totalValue };
  }, [poRows]);

  const disposeStats = useMemo(() => {
    const pending = disposeRows.filter((row) => String(row.status || "").toLowerCase() === "pending").length;
    const approved = disposeRows.filter((row) => String(row.status || "").toLowerCase() === "approved").length;
    return { total: disposeRows.length, pending, approved };
  }, [disposeRows]);

  const historyRows = useMemo(() => {
    const productionMapped = productionRows.map((row) => ({
      id: `production:${row.id}`,
      type: "production",
      reference: row.production_number || "—",
      item: row?.finished_good?.name || row?.finished_good?.sku || "—",
      quantity: `${Number(row.target_quantity ?? 0)} ${row.output_unit || ""}`.trim(),
      location: row.location || "—",
      status: String(row.status || "").toLowerCase(),
      happenedAt: row.completed_at || row.failed_at || row.started_at || null,
    }));
    const disposalMapped = disposeRows.map((row) => ({
      id: `disposal:${row.id}`,
      type: "disposal",
      reference: row.adjustment_number || "—",
      item: row?.inventory_items?.name || row?.inventory_items?.sku || "—",
      quantity: `${Number(row.quantity ?? 0)}`,
      location: row.requested_location || "—",
      status: String(row.status || "").toLowerCase(),
      happenedAt: row.requested_date || row.created_at || null,
    }));
    return [...productionMapped, ...disposalMapped].sort(
      (a, b) => new Date(b.happenedAt || 0).getTime() - new Date(a.happenedAt || 0).getTime()
    );
  }, [disposeRows, productionRows]);

  const filteredHistoryRows = useMemo(() => {
    const term = String(historySearch || "").trim().toLowerCase();
    return historyRows.filter((row) => {
      if (historyTypeFilter !== "all" && row.type !== historyTypeFilter) return false;
      if (!term) return true;
      const blob = [row.reference, row.item, row.location, row.status, row.type].join(" ").toLowerCase();
      return blob.includes(term);
    });
  }, [historyRows, historySearch, historyTypeFilter]);

  const PO_PAGE_SIZE = 4;
  const INVENTORY_PAGE_SIZE = 4;
  const DISPOSE_PAGE_SIZE = 4;
  const HISTORY_PAGE_SIZE = 8;
  const inventoryTotalPages = Math.max(1, Math.ceil(filteredRows.length / INVENTORY_PAGE_SIZE));
  const inventoryStart = (inventoryPage - 1) * INVENTORY_PAGE_SIZE;
  const inventoryPageRows = filteredRows.slice(inventoryStart, inventoryStart + INVENTORY_PAGE_SIZE);
  const poTotalPages = Math.max(1, Math.ceil(filteredPoRows.length / PO_PAGE_SIZE));
  const poStart = (poPage - 1) * PO_PAGE_SIZE;
  const poPageRows = filteredPoRows.slice(poStart, poStart + PO_PAGE_SIZE);
  const disposeTotalPages = Math.max(1, Math.ceil(filteredDisposeRows.length / DISPOSE_PAGE_SIZE));
  const disposeStart = (disposePage - 1) * DISPOSE_PAGE_SIZE;
  const disposePageRows = filteredDisposeRows.slice(disposeStart, disposeStart + DISPOSE_PAGE_SIZE);
  const historyTotalPages = Math.max(1, Math.ceil(filteredHistoryRows.length / HISTORY_PAGE_SIZE));
  const historyStart = (historyPage - 1) * HISTORY_PAGE_SIZE;
  const historyPageRows = filteredHistoryRows.slice(historyStart, historyStart + HISTORY_PAGE_SIZE);

  useEffect(() => {
    setInventoryPage(1);
  }, [search, activeView]);

  useEffect(() => {
    if (inventoryPage > inventoryTotalPages) setInventoryPage(inventoryTotalPages);
  }, [inventoryPage, inventoryTotalPages]);

  useEffect(() => {
    setPoPage(1);
  }, [poSearch, activeView]);

  useEffect(() => {
    if (poPage > poTotalPages) setPoPage(poTotalPages);
  }, [poPage, poTotalPages]);

  useEffect(() => {
    setDisposePage(1);
  }, [disposeSearch, activeView]);

  useEffect(() => {
    if (disposePage > disposeTotalPages) setDisposePage(disposeTotalPages);
  }, [disposePage, disposeTotalPages]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historySearch, historyTypeFilter, activeView]);

  useEffect(() => {
    if (historyPage > historyTotalPages) setHistoryPage(historyTotalPages);
  }, [historyPage, historyTotalPages]);

  const formatMoney = (value) => {
    const n = Number(value ?? 0);
    return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(
      Number.isFinite(n) ? n : 0
    );
  };

  const formatDate = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
  };

  const normalizeStatus = (value) => {
    const text = String(value || "").trim().toLowerCase();
    if (!text) return "pending";
    if (text === "sent" || text === "pending_approval" || text === "discrepancies_found") return "pending";
    if (text === "confirmed" || text === "completed" || text === "approved" || text === "scheduled") return "approved";
    if (text === "cancelled" || text === "rejected") return "rejected";
    return text;
  };

  const reportRows = useMemo(() => {
    if (reportType === "purchase_orders") {
      return poRows.map((row) => ({
        id: row.id,
        reference: row.po_number || "—",
        subject: compactItemNames(row.purchase_order_items) || row?.suppliers?.name || "—",
        quantity: sumBy(row.purchase_order_items, "quantity_ordered") || 0,
        location: extractPoLocation(row.notes),
        status: normalizeStatus(row.status),
        date: row.created_at,
      }));
    }
    if (reportType === "receive_items") {
      return receiveRows.map((row) => ({
        id: row.id,
        reference: row.transaction_number || "—",
        subject: row.supplier_name || "—",
        quantity: sumBy(row.receive_transaction_items, "quantity"),
        location: row.location || compactLocations((row.receive_transaction_items || []).map((item) => item.location)),
        status: normalizeStatus(row.status),
        date: row.created_at,
      }));
    }
    if (reportType === "transfer_items") {
      return transferRows.map((row) => ({
        id: row.id,
        reference: row.transfer_number || "—",
        subject: `${row.from_location || "—"} -> ${row.to_location || "—"}`,
        quantity: sumBy(row.stock_transfer_items, "quantity"),
        location: compactLocations([row.from_location, row.to_location]),
        status: normalizeStatus(row.status),
        date: row.created_at,
      }));
    }
    if (reportType === "deliveries") {
      return deliveryRows.map((row) => ({
        id: row.id,
        reference: row.reference_no || "—",
        subject: row.customer_name || "—",
        quantity: sumBy(row.delivery_request_items, "quantity"),
        location: compactLocations(
          (row.delivery_request_items || []).flatMap((item) => [item.from_location, item.to_location])
        ),
        status: normalizeStatus(row.status),
        date: row.delivery_date || row.created_at,
      }));
    }
    if (reportType === "stock_counts") {
      return countRows.map((row) => ({
        id: row.id,
        reference: row.count_number || "—",
        subject: "Stock Count",
        quantity: "—",
        location: row.location || "—",
        status: normalizeStatus(row.status),
        date: row.completed_at || row.created_at,
      }));
    }
    if (reportType === "disposal_requests") {
      return disposeRows.map((row) => ({
        id: row.id,
        reference: row.adjustment_number || "—",
        subject: row?.inventory_items?.name || row?.inventory_items?.sku || "—",
        quantity: Number(row.quantity ?? 0),
        location: row.requested_location || "—",
        status: normalizeStatus(row.status),
        date: row.requested_date || row.created_at,
      }));
    }
    return [];
  }, [countRows, deliveryRows, disposeRows, poRows, receiveRows, reportType, transferRows]);

  const filteredReportRows = useMemo(() => {
    return reportRows
      .filter((row) => {
      if (reportLocation && String(row.location || "").toLowerCase() !== reportLocation.toLowerCase()) return false;
      if (reportStatus && String(row.status || "").toLowerCase() !== reportStatus.toLowerCase()) return false;
      if (reportItem) {
        const blob = `${row.reference} ${row.subject}`.toLowerCase();
        if (!blob.includes(reportItem.toLowerCase())) return false;
      }
      if (dateFrom) {
        const left = new Date(`${dateFrom}T00:00:00`).getTime();
        const rowDate = new Date(row.date || 0).getTime();
        if (rowDate < left) return false;
      }
      if (dateTo) {
        const right = new Date(`${dateTo}T23:59:59`).getTime();
        const rowDate = new Date(row.date || 0).getTime();
        if (rowDate > right) return false;
      }
      return true;
      })
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [dateFrom, dateTo, reportItem, reportLocation, reportRows, reportStatus]);

  const REPORT_PAGE_SIZE = 9;
  const reportTotalPages = Math.max(1, Math.ceil(filteredReportRows.length / REPORT_PAGE_SIZE));
  const reportStart = (reportPage - 1) * REPORT_PAGE_SIZE;
  const reportPageRows = filteredReportRows.slice(reportStart, reportStart + REPORT_PAGE_SIZE);

  const reportCards = useMemo(
    () => [
      { key: "purchase_orders", title: "PO List", icon: "assignment", count: poRows.length },
      { key: "receive_items", title: "Received List", icon: "inventory", count: receiveRows.length },
      { key: "transfer_items", title: "Transfer List", icon: "swap_horiz", count: transferRows.length },
      { key: "deliveries", title: "Delivery List", icon: "local_shipping", count: deliveryRows.length },
      { key: "disposal_requests", title: "Disposal Report", icon: "delete_sweep", count: disposeRows.length },
    ],
    [countRows.length, deliveryRows.length, disposeRows.length, poRows.length, receiveRows.length, transferRows.length]
  );

  const reportLocationOptions = useMemo(() => {
    const set = new Set();
    reportRows.forEach((row) => {
      const value = String(row.location || "").trim();
      if (value && value !== "—") set.add(value);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [reportRows]);

  const reportStatusOptions = useMemo(() => {
    const set = new Set();
    reportRows.forEach((row) => {
      const value = String(row.status || "").trim().toLowerCase();
      if (value) set.add(value);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [reportRows]);

  const reportTypeLabel = useMemo(() => {
    const map = {
      purchase_orders: "Purchase Orders",
      receive_items: "Receive Items",
      transfer_items: "Transfer Items",
      deliveries: "Deliveries",
      stock_counts: "Stock Counts",
      disposal_requests: "Disposal Requests",
    };
    return map[reportType] || "Report";
  }, [reportType]);

  useEffect(() => {
    setReportPage(1);
  }, [reportType, dateFrom, dateTo, reportLocation, reportItem, reportStatus]);

  useEffect(() => {
    if (reportPage > reportTotalPages) setReportPage(reportTotalPages);
  }, [reportPage, reportTotalPages]);

  const exportReportCsv = () => {
    const headers = ["Reference", "Subject", "Quantity", "Location", "Status", "Date"];
    const lines = filteredReportRows.map((row) =>
      [row.reference, row.subject, row.quantity, row.location, row.status, formatDate(row.date)]
        .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${reportType}-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleInventoryBreakdown = (itemId) => {
    setExpandedInventoryRows((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const ReportTile = ({ title, icon, onClick, disabled = false }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-left shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition-all ${
        disabled
          ? "cursor-not-allowed border-slate-200/70 opacity-55"
          : "border-slate-200/80 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_16px_30px_rgba(59,130,246,0.10)]"
      }`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      </span>
      <span className="text-sm font-semibold leading-tight text-on-surface">{title}</span>
      <span className="ml-auto text-on-surface-variant opacity-0 transition-opacity group-hover:opacity-100">
        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
      </span>
    </button>
  );

  const lists = [
    { key: "report-table", title: "Report Table", icon: "table_view", onClick: () => setActiveView("report-table") },
    { key: "inventory", title: "View Storage", icon: "inventory_2", onClick: () => setActiveView("inventory") },
    { key: "purchase-orders", title: "Purchase Order List", icon: "assignment", onClick: () => setActiveView("purchase-orders") },
    { key: "dispose", title: "Disposal Request List", icon: "delete_sweep", onClick: () => setActiveView("dispose") },
    { key: "history", title: "Production & Disposal History", icon: "history", onClick: () => setActiveView("history") },
    { key: "suppliers", title: "Supplier List", icon: "local_shipping", onClick: () => window.alert("Coming soon.") },
    { key: "locations", title: "Location List", icon: "warehouse", onClick: () => window.alert("Coming soon.") },
    { key: "movements", title: "Stock Movement List", icon: "swap_vert", onClick: () => window.alert("Coming soon.") },
  ];

  const analytics = [
    { key: "lowstock", title: "Low Stock Report", icon: "warning", onClick: () => setActiveView("inventory") },
    { key: "po-summary", title: "PO Summary", icon: "query_stats", onClick: () => setActiveView("purchase-orders") },
    { key: "disposal-summary", title: "Disposal Summary", icon: "summarize", onClick: () => setActiveView("dispose") },
    { key: "aging", title: "Aging Reports", icon: "schedule", onClick: () => window.alert("Coming soon.") },
    { key: "exception", title: "Exception Report", icon: "report", onClick: () => window.alert("Coming soon.") },
    { key: "cashflow", title: "Statement of Cash Flows", icon: "account_balance_wallet", onClick: () => window.alert("Coming soon.") },
  ];

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
              <UserAvatarOrIcon src={profile?.avatar_url} alt={profileDisplayName(profile)} size="md" />
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col justify-center px-2 pb-20 pt-[4.4rem] sm:px-3 lg:px-4 md:pb-2">
        <section className="px-1 py-2 sm:px-2">
          <div className="relative mx-auto w-full overflow-hidden rounded-[2rem] border border-outline-variant/15 bg-gradient-to-b from-surface-container-lowest to-surface shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
            <div className="min-h-[calc(100dvh-7.2rem)]">
              <section className="relative min-h-0 overflow-auto bg-transparent p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-[1180px] space-y-5">
                  <div className="rounded-md bg-primary px-3 py-2 text-white flex items-center justify-between">
                    <h1 className="text-[13px] font-bold tracking-tight">Generate Reports</h1>
                    <Link
                      to="/dashboard"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition-all hover:bg-white/20"
                      aria-label="Close"
                      title="Close"
                    >
                      <span className="material-symbols-outlined text-[12px]">close</span>
                    </Link>
                  </div>
                  {activeView === "home" ? (
                    <>
                      <div className="space-y-5">
                        <div className="mx-auto grid w-full max-w-[980px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {reportCards.map((card) => {
                            return (
                              <button
                                key={card.key}
                                type="button"
                                onClick={() => {
                                  setReportType(card.key);
                                  setActiveView("report-table");
                                }}
                                className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/20"
                              >
                                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                                  <span className="material-symbols-outlined text-[18px]">{card.icon}</span>
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-sm font-semibold text-on-surface">{card.title}</span>
                                  <span className="block text-xs text-on-surface-variant">{card.count} records</span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : activeView === "report-table" ? (
                    <div className="flex h-[calc(100dvh-11.5rem)] w-full flex-col px-0">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveView("home")}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/30 text-on-surface-variant hover:text-on-surface"
                            aria-label="Back to report cards"
                          >
                            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                          </button>
                          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                            {reportTypeLabel} - {filteredReportRows.length} result{filteredReportRows.length === 1 ? "" : "s"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={exportReportCsv}
                            className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-on-primary"
                          >
                            Export to CSV
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                        <input className="rounded-lg bg-surface-container-highest px-3 py-2 text-xs" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                        <input className="rounded-lg bg-surface-container-highest px-3 py-2 text-xs" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                        <select className="rounded-lg bg-surface-container-highest px-3 py-2 text-xs" value={reportLocation} onChange={(e) => setReportLocation(e.target.value)}>
                          <option value="">All locations</option>
                          {reportLocationOptions.map((loc) => (
                            <option key={loc} value={loc}>
                              {loc}
                            </option>
                          ))}
                        </select>
                        <input className="rounded-lg bg-surface-container-highest px-3 py-2 text-xs" placeholder="Item / Ref filter" value={reportItem} onChange={(e) => setReportItem(e.target.value)} />
                        <select className="rounded-lg bg-surface-container-highest px-3 py-2 text-xs" value={reportStatus} onChange={(e) => setReportStatus(e.target.value)}>
                          <option value="">All statuses</option>
                          {reportStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="mt-3 flex-1 overflow-hidden border-y border-outline-variant/10 bg-surface">
                        <div className="h-full overflow-auto">
                          <table className="min-w-full w-max border-collapse text-left">
                            <thead>
                              <tr className="bg-surface-container-low/60">
                                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant whitespace-nowrap">Reference</th>
                                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant whitespace-nowrap">Subject</th>
                                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant whitespace-nowrap">Quantity</th>
                                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant whitespace-nowrap">Location</th>
                                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant whitespace-nowrap">Status</th>
                                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant whitespace-nowrap">Date</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/5">
                              {poLoading || receiveLoading || transferLoading || deliveryLoading || countLoading || disposeLoading ? (
                                <tr>
                                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-on-surface-variant">Loading report data...</td>
                                </tr>
                              ) : filteredReportRows.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-on-surface-variant">No records found.</td>
                                </tr>
                              ) : (
                                reportPageRows.map((row) => (
                                  <tr key={row.id} className="hover:bg-surface-container/30">
                                    <td className="px-3 py-3 text-xs font-semibold text-on-surface whitespace-nowrap">{row.reference}</td>
                                    <td className="px-3 py-3 text-xs text-on-surface whitespace-nowrap">{row.subject}</td>
                                    <td className="px-3 py-3 text-xs text-on-surface-variant whitespace-nowrap">{row.quantity}</td>
                                    <td className="px-3 py-3 text-xs text-on-surface-variant whitespace-nowrap">{row.location}</td>
                                    <td className="px-3 py-3 text-xs uppercase tracking-wide text-on-surface-variant whitespace-nowrap">{row.status || "—"}</td>
                                    <td className="px-3 py-3 text-xs text-on-surface-variant whitespace-nowrap">{formatDate(row.date)}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="flex items-center justify-between bg-surface-container-low/30 px-4 py-2.5">
                        <p className="text-xs text-on-surface-variant">
                          Showing {filteredReportRows.length === 0 ? 0 : reportStart + 1} to {Math.min(reportStart + REPORT_PAGE_SIZE, filteredReportRows.length)} of {filteredReportRows.length}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setReportPage((p) => Math.max(1, p - 1))}
                            disabled={reportPage <= 1}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-container-highest text-on-surface transition-all disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-sm">chevron_left</span>
                          </button>
                          <span className="text-xs text-on-surface-variant">Page {reportPage} of {reportTotalPages}</span>
                          <button
                            type="button"
                            onClick={() => setReportPage((p) => Math.min(reportTotalPages, p + 1))}
                            disabled={reportPage >= reportTotalPages}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-container-highest text-on-surface transition-all disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-sm">chevron_right</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : activeView === "inventory" ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setActiveView("home")}
                          className="inline-flex items-center gap-1 rounded-full border border-outline-variant/30 bg-white/80 px-3 py-1.5 text-xs font-semibold text-on-surface hover:border-primary/25"
                        >
                          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                          Back
                        </button>
                      </div>
                      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <h2 className="text-2xl font-extrabold tracking-tight font-headline text-on-surface">View Storage</h2>
                        <input
                          className="w-full rounded-xl border-none bg-surface-container-highest px-4 py-2.5 text-sm transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 md:w-72"
                          placeholder="Search inventory..."
                          type="search"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="rounded-2xl bg-surface-container-low p-4">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-secondary">Active SKUs</span>
                          <div className="font-headline text-2xl font-extrabold text-on-surface">{loading ? "…" : stats.total.toLocaleString()}</div>
                        </div>
                        <div className="rounded-2xl bg-surface-container-low p-4">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-tertiary">Low stock</span>
                          <div className="font-headline text-2xl font-extrabold text-tertiary">{loading ? "…" : stats.lowStock.toLocaleString()}</div>
                        </div>
                        <div className="rounded-2xl bg-surface-container-low p-4">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-primary">Matching filter</span>
                          <div className="font-headline text-2xl font-extrabold text-on-surface">{loading ? "…" : filteredRows.length.toLocaleString()}</div>
                        </div>
                      </div>

                      {loadError ? (
                        <div className="rounded-xl border border-error/30 bg-error-container/30 px-4 py-3 text-sm text-on-surface">{loadError}</div>
                      ) : null}

                      <div className="overflow-hidden rounded-3xl border border-outline-variant/10 bg-surface-container-lowest shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="min-w-[760px] w-full border-collapse text-left">
                            <thead>
                              <tr className="bg-surface-container-low/60">
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Item Name</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">SKU</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Category</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Type</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Qty On Hand</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Reorder</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/5">
                              {loading ? (
                                <tr>
                                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-on-surface-variant">Loading inventory...</td>
                                </tr>
                              ) : inventoryPageRows.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-on-surface-variant">No items found.</td>
                                </tr>
                              ) : (
                                inventoryPageRows.map((row) => {
                                  const isExpanded = Boolean(expandedInventoryRows[row.id]);
                                  const breakdown = inventoryBreakdownByItem[row.id] ?? [];
                                  return (
                                    <Fragment key={row.id}>
                                      <tr className="hover:bg-surface-container/30">
                                        <td className="px-4 py-3 text-sm font-semibold text-on-surface">{row.name ?? "—"}</td>
                                        <td className="px-4 py-3 text-xs text-on-surface-variant">{row.sku ?? "—"}</td>
                                        <td className="px-4 py-3 text-xs text-on-surface-variant">{row?.categories?.name ?? "Uncategorized"}</td>
                                        <td className="px-4 py-3 text-xs text-on-surface-variant">{String(row.item_type || "ingredient").replace("_", " ")}</td>
                                        <td className="px-4 py-3 text-xs text-on-surface">
                                          <button
                                            type="button"
                                            onClick={() => toggleInventoryBreakdown(row.id)}
                                            className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-surface-container-high"
                                          >
                                            <span>
                                              {Number(row.current_stock ?? 0)}{" "}
                                              <span className="uppercase text-on-surface-variant">{row.unit_of_measure || "unit"}</span>
                                            </span>
                                            <span className="material-symbols-outlined text-[14px] text-on-surface-variant">
                                              {isExpanded ? "expand_less" : "expand_more"}
                                            </span>
                                          </button>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-on-surface-variant">{Number(row.reorder_level ?? 0)}</td>
                                      </tr>
                                      {isExpanded ? (
                                        <tr className="bg-surface-container-low/40">
                                          <td colSpan={6} className="px-4 py-2">
                                            {breakdown.length === 0 ? (
                                              <p className="text-xs text-on-surface-variant">No location breakdown available.</p>
                                            ) : (
                                              <div className="flex flex-wrap gap-2">
                                                {breakdown.map((b) => (
                                                  <span
                                                    key={`${row.id}-${b.location}`}
                                                    className="rounded-full bg-primary-fixed px-2.5 py-1 text-[11px] font-medium text-on-primary-fixed"
                                                  >
                                                    {b.location} - {b.qty}
                                                  </span>
                                                ))}
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      ) : null}
                                    </Fragment>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex items-center justify-between border-t border-outline-variant/10 bg-surface-container-low/30 px-4 py-3">
                          <p className="text-xs text-on-surface-variant">
                            Showing {filteredRows.length === 0 ? 0 : inventoryStart + 1} to {Math.min(inventoryStart + INVENTORY_PAGE_SIZE, filteredRows.length)} of {filteredRows.length}
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setInventoryPage((p) => Math.max(1, p - 1))}
                              disabled={inventoryPage <= 1}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-container-highest text-on-surface transition-all disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-sm">chevron_left</span>
                            </button>
                            <span className="text-xs text-on-surface-variant">Page {inventoryPage} of {inventoryTotalPages}</span>
                            <button
                              type="button"
                              onClick={() => setInventoryPage((p) => Math.min(inventoryTotalPages, p + 1))}
                              disabled={inventoryPage >= inventoryTotalPages}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-container-highest text-on-surface transition-all disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-sm">chevron_right</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : activeView === "purchase-orders" ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setActiveView("home")}
                          className="inline-flex items-center gap-1 rounded-full border border-outline-variant/30 bg-white/80 px-3 py-1.5 text-xs font-semibold text-on-surface hover:border-primary/25"
                        >
                          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                          Back
                        </button>
                      </div>
                      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <h2 className="text-2xl font-extrabold tracking-tight font-headline text-on-surface">Purchase Orders</h2>
                        <input
                          className="w-full rounded-xl border-none bg-surface-container-highest px-4 py-2.5 text-sm transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 md:w-72"
                          placeholder="Search POs..."
                          type="search"
                          value={poSearch}
                          onChange={(e) => setPoSearch(e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <div className="rounded-2xl bg-surface-container-low p-4">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-secondary">Total POs</span>
                          <div className="font-headline text-2xl font-extrabold text-on-surface">{poLoading ? "…" : poStats.total}</div>
                        </div>
                        <div className="rounded-2xl bg-surface-container-low p-4">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-tertiary">Pending</span>
                          <div className="font-headline text-2xl font-extrabold text-tertiary">{poLoading ? "…" : poStats.pending}</div>
                        </div>
                        <div className="rounded-2xl bg-surface-container-low p-4">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-primary">In Transit</span>
                          <div className="font-headline text-2xl font-extrabold text-on-surface">{poLoading ? "…" : poStats.inTransit}</div>
                        </div>
                        <div className="rounded-2xl bg-surface-container-low p-4">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-primary">Total Value</span>
                          <div className="font-headline text-2xl font-extrabold text-on-surface">{poLoading ? "…" : formatMoney(poStats.totalValue)}</div>
                        </div>
                      </div>

                      {poError ? (
                        <div className="rounded-xl border border-error/30 bg-error-container/30 px-4 py-3 text-sm text-on-surface">{poError}</div>
                      ) : null}

                      <div className="overflow-hidden rounded-3xl border border-outline-variant/10 bg-surface-container-lowest shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="min-w-[960px] w-full border-collapse text-left">
                            <thead>
                              <tr className="bg-surface-container-low/60">
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">PO Number</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Supplier</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Status</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Items</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Total</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Order Date</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Expected</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/5">
                              {poLoading ? (
                                <tr>
                                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-on-surface-variant">Loading purchase orders...</td>
                                </tr>
                              ) : poPageRows.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-on-surface-variant">No purchase orders found.</td>
                                </tr>
                              ) : (
                                poPageRows.map((row) => (
                                  <tr key={row.id} className="hover:bg-surface-container/30">
                                    <td className="px-4 py-3 text-sm font-semibold text-on-surface">{row.po_number ?? "—"}</td>
                                    <td className="px-4 py-3 text-xs text-on-surface">{row?.suppliers?.name ?? "—"}</td>
                                    <td className="px-4 py-3 text-[11px] uppercase tracking-wide text-on-surface-variant">{String(row.status || "draft").replace("_", " ")}</td>
                                    <td className="px-4 py-3 text-xs text-on-surface-variant">{Array.isArray(row.purchase_order_items) ? row.purchase_order_items.length : 0}</td>
                                    <td className="px-4 py-3 text-xs font-semibold text-on-surface">{formatMoney(row.total_amount)}</td>
                                    <td className="px-4 py-3 text-xs text-on-surface-variant">{formatDate(row.created_at)}</td>
                                    <td className="px-4 py-3 text-xs text-on-surface-variant">{formatDate(row.expected_delivery_date)}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex items-center justify-between border-t border-outline-variant/10 bg-surface-container-low/30 px-4 py-3">
                          <p className="text-xs text-on-surface-variant">
                            Showing {filteredPoRows.length === 0 ? 0 : poStart + 1} to {Math.min(poStart + PO_PAGE_SIZE, filteredPoRows.length)} of {filteredPoRows.length}
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPoPage((p) => Math.max(1, p - 1))}
                              disabled={poPage <= 1}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-container-highest text-on-surface transition-all disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-sm">chevron_left</span>
                            </button>
                            <span className="text-xs text-on-surface-variant">Page {poPage} of {poTotalPages}</span>
                            <button
                              type="button"
                              onClick={() => setPoPage((p) => Math.min(poTotalPages, p + 1))}
                              disabled={poPage >= poTotalPages}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-container-highest text-on-surface transition-all disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-sm">chevron_right</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : activeView === "history" ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setActiveView("home")}
                          className="inline-flex items-center gap-1 rounded-full border border-outline-variant/30 bg-white/80 px-3 py-1.5 text-xs font-semibold text-on-surface hover:border-primary/25"
                        >
                          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                          Back
                        </button>
                      </div>
                      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div>
                          <h2 className="text-2xl font-extrabold tracking-tight font-headline text-on-surface">Production & Disposal Audit Trail</h2>
                          <p className="mt-1 text-xs text-on-surface-variant">
                            Includes production runs (in progress/completed/failed) and disposal requests (draft/pending/disposed/cancelled).
                          </p>
                        </div>
                        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
                          <select
                            className="rounded-xl border-none bg-surface-container-highest px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20"
                            value={historyTypeFilter}
                            onChange={(e) => setHistoryTypeFilter(e.target.value)}
                          >
                            <option value="all">All Modules</option>
                            <option value="production">Production</option>
                            <option value="disposal">Disposal</option>
                          </select>
                          <input
                            className="w-full rounded-xl border-none bg-surface-container-highest px-4 py-2.5 text-sm transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 md:w-72"
                            placeholder="Search history..."
                            type="search"
                            value={historySearch}
                            onChange={(e) => setHistorySearch(e.target.value)}
                          />
                        </div>
                      </div>

                      {productionError ? (
                        <div className="rounded-xl border border-error/30 bg-error-container/30 px-4 py-3 text-sm text-on-surface">{productionError}</div>
                      ) : null}

                      <div className="overflow-hidden rounded-3xl border border-outline-variant/10 bg-surface-container-lowest shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="min-w-[980px] w-full border-collapse text-left">
                            <thead>
                              <tr className="bg-surface-container-low/60">
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Module</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Reference</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Item</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Quantity</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Location</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Date</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/5">
                              {productionLoading || disposeLoading ? (
                                <tr>
                                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-on-surface-variant">Loading history...</td>
                                </tr>
                              ) : historyPageRows.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-on-surface-variant">No history records found.</td>
                                </tr>
                              ) : (
                                historyPageRows.map((row) => (
                                  <tr key={row.id} className="hover:bg-surface-container/30">
                                    <td className="px-4 py-3 text-xs font-semibold text-on-surface">{row.type === "production" ? "Production" : "Disposal"}</td>
                                    <td className="px-4 py-3 text-xs text-on-surface">{row.reference}</td>
                                    <td className="px-4 py-3 text-xs text-on-surface">{row.item}</td>
                                    <td className="px-4 py-3 text-xs text-on-surface-variant">{row.quantity}</td>
                                    <td className="px-4 py-3 text-xs text-on-surface-variant">{row.location}</td>
                                    <td className="px-4 py-3 text-xs text-on-surface-variant">{formatDate(row.happenedAt)}</td>
                                    <td className="px-4 py-3 text-[11px] uppercase tracking-wide text-on-surface-variant">
                                      {historyStatusLabel(row.type, row.status)}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex items-center justify-between border-t border-outline-variant/10 bg-surface-container-low/30 px-4 py-3">
                          <p className="text-xs text-on-surface-variant">
                            Showing {filteredHistoryRows.length === 0 ? 0 : historyStart + 1} to {Math.min(historyStart + HISTORY_PAGE_SIZE, filteredHistoryRows.length)} of {filteredHistoryRows.length}
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                              disabled={historyPage <= 1}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-container-highest text-on-surface transition-all disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-sm">chevron_left</span>
                            </button>
                            <span className="text-xs text-on-surface-variant">Page {historyPage} of {historyTotalPages}</span>
                            <button
                              type="button"
                              onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                              disabled={historyPage >= historyTotalPages}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-container-highest text-on-surface transition-all disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-sm">chevron_right</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setActiveView("home")}
                          className="inline-flex items-center gap-1 rounded-full border border-outline-variant/30 bg-white/80 px-3 py-1.5 text-xs font-semibold text-on-surface hover:border-primary/25"
                        >
                          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                          Back
                        </button>
                      </div>
                      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <h2 className="text-2xl font-extrabold tracking-tight font-headline text-on-surface">Dispose Items</h2>
                        <input
                          className="w-full rounded-xl border-none bg-surface-container-highest px-4 py-2.5 text-sm transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 md:w-72"
                          placeholder="Search disposal..."
                          type="search"
                          value={disposeSearch}
                          onChange={(e) => setDisposeSearch(e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="rounded-2xl bg-surface-container-low p-4">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-secondary">Total Requests</span>
                          <div className="font-headline text-2xl font-extrabold text-on-surface">{disposeLoading ? "…" : disposeStats.total}</div>
                        </div>
                        <div className="rounded-2xl bg-surface-container-low p-4">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-tertiary">Pending</span>
                          <div className="font-headline text-2xl font-extrabold text-tertiary">{disposeLoading ? "…" : disposeStats.pending}</div>
                        </div>
                        <div className="rounded-2xl bg-surface-container-low p-4">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-primary">Approved</span>
                          <div className="font-headline text-2xl font-extrabold text-on-surface">{disposeLoading ? "…" : disposeStats.approved}</div>
                        </div>
                      </div>

                      {disposeError ? (
                        <div className="rounded-xl border border-error/30 bg-error-container/30 px-4 py-3 text-sm text-on-surface">{disposeError}</div>
                      ) : null}

                      <div className="overflow-hidden rounded-3xl border border-outline-variant/10 bg-surface-container-lowest shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="min-w-[960px] w-full border-collapse text-left">
                            <thead>
                              <tr className="bg-surface-container-low/60">
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Request No.</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Item</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Type</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Qty</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Location</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Date</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/5">
                              {disposeLoading ? (
                                <tr>
                                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-on-surface-variant">Loading disposal requests...</td>
                                </tr>
                              ) : disposePageRows.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-on-surface-variant">No disposal requests found.</td>
                                </tr>
                              ) : (
                                disposePageRows.map((row) => (
                                  <tr key={row.id} className="hover:bg-surface-container/30">
                                    <td className="px-4 py-3 text-sm font-semibold text-on-surface">{row.adjustment_number ?? "—"}</td>
                                    <td className="px-4 py-3 text-xs text-on-surface">{row?.inventory_items?.name || row?.inventory_items?.sku || "—"}</td>
                                    <td className="px-4 py-3 text-xs text-on-surface-variant">{String(row.adjustment_type || "—").replace("_", " ")}</td>
                                    <td className="px-4 py-3 text-xs text-on-surface-variant">{Number(row.quantity ?? 0)}</td>
                                    <td className="px-4 py-3 text-xs text-on-surface-variant">{row.requested_location ?? "—"}</td>
                                    <td className="px-4 py-3 text-xs text-on-surface-variant">{formatDate(row.requested_date || row.created_at)}</td>
                                    <td className="px-4 py-3 text-[11px] uppercase tracking-wide text-on-surface-variant">{row.status ?? "pending"}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex items-center justify-between border-t border-outline-variant/10 bg-surface-container-low/30 px-4 py-3">
                          <p className="text-xs text-on-surface-variant">
                            Showing {filteredDisposeRows.length === 0 ? 0 : disposeStart + 1} to {Math.min(disposeStart + DISPOSE_PAGE_SIZE, filteredDisposeRows.length)} of {filteredDisposeRows.length}
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setDisposePage((p) => Math.max(1, p - 1))}
                              disabled={disposePage <= 1}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-container-highest text-on-surface transition-all disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-sm">chevron_left</span>
                            </button>
                            <span className="text-xs text-on-surface-variant">Page {disposePage} of {disposeTotalPages}</span>
                            <button
                              type="button"
                              onClick={() => setDisposePage((p) => Math.min(disposeTotalPages, p + 1))}
                              disabled={disposePage >= disposeTotalPages}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-surface-container-highest text-on-surface transition-all disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-sm">chevron_right</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </section>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

