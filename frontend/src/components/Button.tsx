import { clsx } from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export function Button({
  children,
  className,
  variant = "secondary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-cyan-500/30 dark:focus:ring-cyan-400/30";

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
  } as const;

  const variants = {
    primary:
      "text-white bg-gradient-to-r from-cyan-500 via-sky-500 to-fuchsia-500 shadow-glow hover:brightness-105",
    secondary:
      "text-slate-900 bg-white/70 border border-black/10 hover:bg-white/90 shadow-sm dark:text-white dark:bg-white/10 dark:border-white/10 dark:hover:bg-white/15",
    ghost:
      "text-slate-700 hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/10",
    danger:
      "text-white bg-gradient-to-r from-rose-500 to-fuchsia-500 hover:brightness-105",
  } as const;

  return (
    <button
      {...props}
      className={clsx(base, sizes[size], variants[variant], className)}
    >
      {children}
    </button>
  );
}