import { Link, useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Button } from "./Button";

export type Crumb = { label: string; to?: string };

export function Breadcrumbs({
  items,
  backTo,
  backLabel = "Back",
}: {
  items: Crumb[];
  backTo?: string;
  backLabel?: string;
}) {
  const nav = useNavigate();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1 text-sm">
        {items.map((c, idx) => (
          <div key={idx} className="flex items-center gap-1">
            {c.to ? (
              <Link className="link-accent" to={c.to}>{c.label}</Link>
            ) : (
              <span className="muted">{c.label}</span>
            )}
            {idx < items.length - 1 ? <ChevronRight className="h-4 w-4 muted" /> : null}
          </div>
        ))}
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          if (backTo) nav(backTo);
          else nav(-1);
        }}
      >
        ← {backLabel}
      </Button>
    </div>
  );
}