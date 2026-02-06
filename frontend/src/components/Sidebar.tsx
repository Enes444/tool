import { Link, useLocation } from "react-router-dom";
import {
  Inbox,
  Building2,
  Tickets,
  BadgeCheck,
  Globe,
} from "lucide-react";

const nav = [
  { to: "/", label: "Inbox", icon: Inbox },
  { to: "/settings", label: "Settings", icon: Building2, hint: "Organization & workspace" },
  { to: "/tickets", label: "Tickets", icon: Tickets },
  { to: "/claims", label: "Claims", icon: BadgeCheck },
  { to: "/portal", label: "Sponsor Portal", icon: Globe, external: true },
];

export function Sidebar() {
  const loc = useLocation();
  return (
    <aside className="hidden w-64 shrink-0 md:block">
      <div className="sticky top-16 space-y-3">
        <div className="surface p-3">
          <div className="text-xs font-semibold tracking-wide text-slate-500 dark:text-white/60">
            NAVIGATION
          </div>
          <nav className="mt-2 space-y-1">
            {nav.map((item) => {
              const active = item.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition " +
                    (active
                      ? "bg-black/5 text-slate-900 shadow-soft dark:bg-white/10 dark:text-white"
                      : "text-slate-600 hover:bg-black/5 hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white")
                  }
                >
                  <span className={"grid h-8 w-8 place-items-center rounded-xl border " + (active ? "border-black/10 bg-white/70 dark:border-white/10 dark:bg-white/10" : "border-black/10 bg-white/50 dark:border-white/10 dark:bg-white/5")}
                  >
                    <Icon size={16} />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {item.external ? (
                    <span className="text-[10px] rounded-full border hairline px-2 py-0.5 muted">Public</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="surface p-3">
          <div className="text-xs font-semibold tracking-wide text-slate-500 dark:text-white/60">
            WORKSPACE
          </div>
          <div className="mt-2 text-xs leading-relaxed muted">
            <div className="font-medium text-slate-800 dark:text-white">Run delivery, approvals, claims and support in one place.</div>
            <div className="mt-1">Use Settings for organization setup and team operations.</div>
          </div>
        </div>
      </div>
    </aside>
  );
}