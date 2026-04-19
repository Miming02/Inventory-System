import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { getErrorMessage } from "../lib/errors";

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const wrapRef = useRef(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setErr("");
    const { data, error } = await supabase
      .from("notifications")
      .select("id,title,message,type,is_read,action_url,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      setErr(getErrorMessage(error));
      setItems([]);
    } else {
      setItems(data ?? []);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) load();
  }, [user?.id, load]);

  useEffect(() => {
    if (!open || !user?.id) return;
    load();
  }, [open, user?.id, load]);

  useEffect(() => {
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const unread = items.filter((n) => !n.is_read).length;

  const markRead = async (id) => {
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (!error) load();
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 rounded-lg transition-all active:scale-95 duration-200 text-slate-500 dark:text-slate-400 relative"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Notifications"
      >
        <span className="material-symbols-outlined">notifications</span>
        {unread > 0 ? (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-tertiary text-[10px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-[min(100vw-2rem,380px)] rounded-xl border border-surface-container bg-surface-container-lowest shadow-lg z-[60] max-h-[min(70vh,420px)] flex flex-col">
          <div className="px-3 py-2 border-b border-outline-variant/15 flex justify-between items-center">
            <span className="text-sm font-bold text-on-surface">Notifications</span>
            <button type="button" className="text-xs text-primary font-semibold hover:underline" onClick={() => load()}>
              Refresh
            </button>
          </div>
          <div className="overflow-y-auto flex-1">
            {err ? (
              <p className="p-3 text-xs text-error">{err}</p>
            ) : loading && items.length === 0 ? (
              <p className="p-4 text-sm text-on-surface-variant text-center">Loading…</p>
            ) : items.length === 0 ? (
              <p className="p-4 text-sm text-on-surface-variant text-center">No notifications yet.</p>
            ) : (
              <ul className="divide-y divide-outline-variant/10">
                {items.map((n) => (
                  <li key={n.id} className="px-3 py-2.5 hover:bg-surface-container-low/80">
                    <div className="flex gap-2 justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold ${n.is_read ? "text-on-surface-variant" : "text-on-surface"}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-on-surface-variant/80 mt-1">
                          {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                        </p>
                        {n.action_url ? (
                          <Link
                            to={n.action_url}
                            className="text-xs text-primary font-semibold mt-1 inline-block"
                            onClick={() => setOpen(false)}
                          >
                            Open
                          </Link>
                        ) : null}
                      </div>
                      {!n.is_read ? (
                        <button
                          type="button"
                          className="text-[10px] uppercase font-bold text-primary shrink-0"
                          onClick={() => markRead(n.id)}
                        >
                          Mark read
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
