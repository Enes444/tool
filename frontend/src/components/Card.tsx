import { clsx } from "clsx";

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("surface", className)}>{children}</div>;
}
export function CardHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b hairline p-4">
      <div>
        <div className="text-base font-semibold">{title}</div>
        {subtitle ? <div className="mt-1 text-sm muted">{subtitle}</div> : null}
      </div>
      {right}
    </div>
  );
}
export function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="p-4">{children}</div>;
}