import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { NotificationBell } from "../../components/NotificationBell";
import { UserAvatarOrIcon } from "../../components/UserAvatarOrIcon";
import { canManageUsers } from "../../lib/roleAccess";

function profileDisplayName(profile) {
  if (!profile) return "Inventory user";
  const firstName = String(profile.first_name || "").trim();
  const lastName = String(profile.last_name || "").trim();
  if (firstName || lastName) return [firstName, lastName].filter(Boolean).join(" ");
  return profile.email || "Inventory user";
}

function SettingsTile({ title, icon, to, disabled = false }) {
  if (disabled) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-left shadow-[0_10px_24px_rgba(15,23,42,0.06)] opacity-55">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </span>
        <span className="text-sm font-semibold leading-tight text-on-surface">{title}</span>
      </div>
    );
  }

  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-left shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_16px_30px_rgba(59,130,246,0.10)]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      </span>
      <span className="text-sm font-semibold leading-tight text-on-surface">{title}</span>
      <span className="ml-auto text-on-surface-variant opacity-0 transition-opacity group-hover:opacity-100">
        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
      </span>
    </Link>
  );
}

export default function SystemSettings() {
  const { profile, role } = useAuth();
  const isAdmin = canManageUsers(role);

  const accessTiles = [
    { key: "users", title: "User Management", icon: "group", to: "/users", adminOnly: true },
    { key: "audit", title: "Audit Log", icon: "history", to: "/audit-logs", adminOnly: true },
    { key: "approvals", title: "Approval Configuration", icon: "verified_user", to: "/approvals", adminOnly: false },
  ];

  const dataTiles = [
    { key: "suppliers", title: "Manage Suppliers", icon: "local_shipping", to: "/manage-suppliers", adminOnly: false },
    { key: "locations", title: "Manage Locations", icon: "warehouse", to: "/manage-locations", adminOnly: false },
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
                <div className="mx-auto max-w-[1180px] space-y-7">
                  <div className="rounded-md bg-primary px-3 py-2 text-white flex items-center justify-between">
                    <h1 className="text-[13px] font-bold tracking-tight">System Settings</h1>
                    <Link
                      to="/dashboard"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition-all hover:bg-white/20"
                      aria-label="Close"
                      title="Close"
                    >
                      <span className="material-symbols-outlined text-[12px]">close</span>
                    </Link>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">Access & Workflow</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {accessTiles.map((tile) => (
                        <SettingsTile
                          key={tile.key}
                          title={tile.title}
                          icon={tile.icon}
                          to={tile.to}
                          disabled={tile.adminOnly && !isAdmin}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">Master Data</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {dataTiles.map((tile) => (
                        <SettingsTile
                          key={tile.key}
                          title={tile.title}
                          icon={tile.icon}
                          to={tile.to}
                          disabled={tile.adminOnly && !isAdmin}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

