import { clsx } from "clsx";

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "green" | "yellow" | "red" | "blue" }) {
  const cls = clsx(
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
    tone === "neutral" && "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-white/10 dark:text-white/80 dark:ring-white/15",
    tone === "green" && "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/20",
    tone === "yellow" && "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-400/20",
    tone === "red" && "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-400/20",
    tone === "blue" && "bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-200 dark:ring-cyan-400/20",
  );
  return <span className={cls}>{children}</span>;
}