import { clsx } from "clsx";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "w-full rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm shadow-sm",
        "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30",
        "dark:border-white/10 dark:bg-white/5 dark:placeholder:text-white/40 dark:focus:ring-cyan-400/30",
        props.className
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={clsx(
        "w-full rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm shadow-sm",
        "placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30",
        "dark:border-white/10 dark:bg-white/5 dark:placeholder:text-white/40 dark:focus:ring-cyan-400/30",
        props.className
      )}
    />
  );
}