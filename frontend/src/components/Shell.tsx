import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, LogOut, Sparkles } from "lucide-react";
import { clearToken, getToken } from "../lib/api";
import { Button } from "./Button";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";

function isPublicPath(pathname: string) {
  return pathname.startsWith("/portal") || pathname.startsWith("/login");
}

export function Shell({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  const loc = useLocation();
  const authed = !!getToken();
  const publicMode = isPublicPath(loc.pathname) || !authed;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b hairline bg-white/55 backdrop-blur dark:bg-black/30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to={authed ? "/" : "/portal"} className="group flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-fuchsia-500 text-white shadow-glow">
              <Sparkles size={16} />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-wide">Sponsor Ops</div>
              <div className="text-[11px] muted">
                {authed ? "Operations Workspace" : "Sponsor Portal"}
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link className="hidden text-sm link-accent md:block" to="/portal">
              Sponsor Portal
            </Link>
            {authed ? (
              <div className="hidden items-center gap-2 md:flex">
                <button
                  className="surface-soft grid h-10 w-10 place-items-center"
                  title="Notifications (pilot)"
                  onClick={() => nav("/")}
                >
                  <Bell size={16} />
                </button>
              </div>
            ) : null}
            <ThemeToggle />
            {authed ? (
              <Button
                variant="secondary"
                onClick={() => {
                  clearToken();
                  nav("/login");
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <LogOut size={16} /> Logout
                </span>
              </Button>
            ) : (
              <Link className="text-sm link-accent" to="/login">
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {publicMode ? (
          children
        ) : (
          <div className="flex gap-6">
            <Sidebar />
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        )}
      </main>
    </div>
  );
}