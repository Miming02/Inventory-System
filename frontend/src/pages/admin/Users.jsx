import { useState, useEffect, useCallback } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { UserAvatarOrIcon } from "../../components/UserAvatarOrIcon";
import { NotificationBell } from "../../components/NotificationBell";

function AddUserModal({ open, onClose, roles, onInvited }) {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    roleId: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setFormData({ fullName: "", email: "", roleId: "" });
      setError("");
      setSaving(false);
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("invite-user", {
        body: {
          email: formData.email.trim(),
          fullName: formData.fullName.trim(),
          roleId: formData.roleId,
        },
      });

      if (fnError) {
        setError(fnError.message || "Invite failed. Is the Edge Function deployed?");
        setSaving(false);
        return;
      }

      if (data && typeof data === "object" && data.error) {
        setError(typeof data.error === "string" ? data.error : "Invite failed.");
        setSaving(false);
        return;
      }

      onInvited?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-sm">
      <div className="bg-surface-container-lowest w-full max-w-xl rounded-[2rem] overflow-hidden shadow-[0_12px_32px_-4px_rgba(23,28,31,0.06)] border border-white/20">
        <div className="px-10 pt-10 pb-6">
          <div className="flex justify-between items-start mb-4">
            <div className="w-14 h-14 bg-primary-fixed rounded-2xl flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-3xl">person_add</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-on-surface">Add New User</h2>
          <p className="text-on-surface-variant mt-1">Admin invites the user by email and assigns a role.</p>
        </div>

        <form onSubmit={handleSubmit} className="px-10 pb-10 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-error-container text-on-error-container text-sm font-medium">{error}</div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-bold text-on-surface ml-1" htmlFor="fullName">
              Full Name
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant group-focus-within:text-primary transition-colors">
                <span className="material-symbols-outlined">person</span>
              </div>
              <input
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                className="w-full bg-surface-container-highest border-none rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all placeholder:text-on-surface-variant/50"
                placeholder="e.g. Julian Vester"
                type="text"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-on-surface ml-1" htmlFor="email">
              Email Address
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant group-focus-within:text-primary transition-colors">
                <span className="material-symbols-outlined">mail</span>
              </div>
              <input
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full bg-surface-container-highest border-none rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all placeholder:text-on-surface-variant/50"
                placeholder="name@company.com"
                type="email"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-on-surface ml-1" htmlFor="roleId">
              Role
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant group-focus-within:text-primary transition-colors">
                <span className="material-symbols-outlined">shield_person</span>
              </div>
              <select
                id="roleId"
                name="roleId"
                value={formData.roleId}
                onChange={handleChange}
                className="w-full bg-surface-container-highest border-none rounded-2xl py-4 pl-12 pr-10 appearance-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all cursor-pointer"
                required
              >
                <option disabled value="">
                  Select a role
                </option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-on-surface-variant">
                <span className="material-symbols-outlined">expand_more</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-8 py-4 bg-secondary-container text-on-secondary-container font-bold rounded-full hover:bg-surface-container-high transition-all active:scale-95 text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || roles.length === 0}
              className="flex-[1.5] px-8 py-4 bg-gradient-to-r from-primary to-primary-container text-white font-bold rounded-full shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-95 text-center disabled:opacity-50"
            >
              {saving ? "Sending invite…" : "Invite user"}
            </button>
          </div>
        </form>

        <div className="px-10 py-6 bg-surface-container-low/50 border-t border-outline-variant/10 text-center">
          <p className="text-xs text-on-surface-variant">
            Supabase sends an invitation email so they can set their password. Configure SMTP in Auth settings if emails do not arrive.
          </p>
        </div>
      </div>
    </div>
  );
}

function formatUpdatedAt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
}

function profileDisplayName(profile) {
  if (!profile) return "Inventory user";
  const firstName = String(profile.first_name || "").trim();
  const lastName = String(profile.last_name || "").trim();
  if (firstName || lastName) return [firstName, lastName].filter(Boolean).join(" ");
  return profile.email || "Inventory user";
}

export default function Users() {
  const { profile, role: currentRole, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [rows, setRows] = useState([]);
  const [roleOptions, setRoleOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const loadData = useCallback(async () => {
    setListError("");
    setLoading(true);

    const [profRes, rolesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, first_name, last_name, avatar_url, is_active, updated_at, roles(name)")
        .order("updated_at", { ascending: false }),
      supabase.from("roles").select("id, name").order("name"),
    ]);

    if (profRes.error) {
      setListError(profRes.error.message);
      setRows([]);
    } else {
      setRows(profRes.data ?? []);
    }

    if (!rolesRes.error && rolesRes.data) {
      setRoleOptions(rolesRes.data);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && currentRole === "Admin") {
      loadData();
    }
  }, [loadData, authLoading, currentRole]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-on-surface-variant">
        Loading…
      </div>
    );
  }

  if (currentRole !== "Admin") {
    return <Navigate to="/" replace />;
  }

  const getRoleBadgeClass = (roleName) => {
    const roleClasses = {
      Admin: "bg-primary-fixed text-on-primary-fixed-variant",
      Management: "bg-secondary-container text-on-secondary-container",
      "Warehouse Staff": "bg-surface-container-highest text-on-surface-variant",
      "Procurement Staff": "bg-primary-fixed-dim/20 text-primary",
      "Production Staff": "bg-secondary-fixed-dim/30 text-on-secondary-fixed-variant",
    };
    return roleClasses[roleName] || "bg-surface-container-highest text-on-surface-variant";
  };

  const displayName = (row) => {
    const fn = (row.first_name ?? "").trim();
    const ln = (row.last_name ?? "").trim();
    const both = [fn, ln].filter(Boolean).join(" ");
    return both || row.email || "User";
  };

  const filteredUsers = rows.filter((u) => {
    const q = searchTerm.toLowerCase();
    const name = displayName(u).toLowerCase();
    const email = (u.email ?? "").toLowerCase();
    const r = (u.roles?.name ?? "").toLowerCase();
    return name.includes(q) || email.includes(q) || r.includes(q);
  });

  const activeCount = rows.filter((u) => u.is_active).length;
  const inactiveCount = rows.length - activeCount;

  return (
    <div className="bg-background text-on-surface min-h-screen">
      <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-white/80 shadow-sm shadow-blue-900/5 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8 max-w-[1440px]">
          <div className="flex items-center gap-6 min-w-0">
            <Link
              to="/dashboard"
              className="text-xl font-bold tracking-tighter text-slate-900 transition-opacity hover:opacity-90 font-headline"
            >
              Inventory
            </Link>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 lg:gap-6 min-w-0">
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                search
              </span>
              <input
                className="pl-10 pr-4 py-2 bg-surface-container-highest border-none rounded-full text-sm w-64 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all"
                placeholder="Search team..."
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <NotificationBell />
            <span className="shrink-0 rounded-full border-2 border-surface-bright bg-surface-container-high p-0">
              <UserAvatarOrIcon src={profile?.avatar_url} alt={profileDisplayName(profile)} size="md" />
            </span>
          </div>
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
            <div className="min-h-[calc(100dvh-7.2rem)]">
              <section className="relative min-h-0 overflow-auto bg-transparent p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-[1180px] space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">Users Management</h1>
                    <button
                      type="button"
                      onClick={() => setShowAddUserModal(true)}
                      className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-2 rounded-full text-sm font-bold shadow-md hover:scale-[0.98] transition-transform active:scale-95 duration-150"
                    >
                      Add User
                    </button>
                  </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-surface-container-low p-6 rounded-xl">
            <p className="text-on-surface-variant text-sm font-medium mb-1">Total Users</p>
            <p className="text-3xl font-extrabold text-primary">{loading ? "…" : rows.length}</p>
          </div>
          <div className="bg-surface-container-low p-6 rounded-xl">
            <p className="text-on-surface-variant text-sm font-medium mb-1">Active</p>
            <p className="text-3xl font-extrabold text-primary">{loading ? "…" : activeCount}</p>
          </div>
          <div className="bg-surface-container-low p-6 rounded-xl">
            <p className="text-on-surface-variant text-sm font-medium mb-1">Inactive</p>
            <p className="text-3xl font-extrabold text-tertiary">{loading ? "…" : inactiveCount}</p>
          </div>
          <div className="bg-surface-container-low p-6 rounded-xl">
            <p className="text-on-surface-variant text-sm font-medium mb-1">Role types</p>
            <p className="text-3xl font-extrabold text-primary">{loading ? "…" : roleOptions.length}</p>
          </div>
        </div>

        {listError && (
          <div className="mb-6 p-4 rounded-xl bg-error-container text-on-error-container text-sm font-medium">{listError}</div>
        )}

        <section className="bg-surface-container-lowest rounded-xl shadow-sm shadow-blue-900/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low">
                  <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-on-surface-variant">User</th>
                  <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Role</th>
                  <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Status</th>
                  <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Last updated</th>
                  <th className="px-8 py-5 text-xs font-bold uppercase tracking-widest text-on-surface-variant text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high/30">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-12 text-center text-on-surface-variant">
                      Loading users…
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-12 text-center text-on-surface-variant">
                      No users found. Invite someone with Add User (requires deployed invite-user function).
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const roleName = user.roles?.name ?? "—";
                    const statusLabel = user.is_active ? "Active" : "Inactive";
                    return (
                      <tr key={user.id} className="hover:bg-surface-container-low/50 transition-colors group">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <UserAvatarOrIcon src={user.avatar_url} alt={displayName(user)} size="lg" />
                            <div>
                              <div className="font-bold text-on-surface">{displayName(user)}</div>
                              <div className="text-sm text-on-surface-variant">{user.email ?? "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span
                            className={`px-4 py-1 rounded-full text-xs font-bold ${getRoleBadgeClass(roleName)}`}
                          >
                            {roleName}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                user.is_active ? "bg-primary animate-pulse" : "bg-outline-variant"
                              }`}
                            />
                            <span
                              className={`text-sm font-medium ${
                                user.is_active ? "text-on-surface" : "text-outline"
                              }`}
                            >
                              {statusLabel}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-sm text-on-surface-variant">{formatUpdatedAt(user.updated_at)}</td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs text-on-surface-variant">—</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-8 py-6 bg-surface-container-low flex justify-between items-center border-t border-outline-variant/10">
            <span className="text-sm text-on-surface-variant font-medium">
              Showing {filteredUsers.length} of {rows.length} users
            </span>
          </div>
        </section>
                </div>
              </section>
            </div>
          </div>
        </section>
      </main>

      <AddUserModal
        open={showAddUserModal}
        onClose={() => setShowAddUserModal(false)}
        roles={roleOptions}
        onInvited={loadData}
      />
    </div>
  );
}
