import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { Card, CardBody, CardHeader } from "../components/Card";
import { Badge } from "../components/Badge";
import { Link } from "react-router-dom";
import { Input } from "../components/Input";

export function ClaimsPage() {
  const [claims, setClaims] = useState<any[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [q, setQ] = useState("");

  async function refresh() {
    const orgs = await api.listOrgs();
    const orgId = orgs?.[0]?.id;
    if (!orgId) return;
    const c = await api.listClaims(orgId, includeArchived);
    setClaims(c);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeArchived]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return claims;
    return claims.filter((c) => `${c.id} ${c.status} ${c.reason} ${c.deal_id} ${c.deliverable_id}`.toLowerCase().includes(qq));
  }, [claims, q]);

  const activeCount = claims.filter((c) => !c.archived_at).length;
  const archivedCount = claims.filter((c) => !!c.archived_at).length;

  return (
    <Card>
      <CardHeader
        title="Claims"
        subtitle="Guaranteed delivery workflow"
        right={
          <div className="flex items-center gap-2">
            <Badge tone="blue">{activeCount} active</Badge>
            {includeArchived ? <Badge tone="neutral">{archivedCount} archived</Badge> : null}
          </div>
        }
      />
      <CardBody>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
            <span className="muted">Show archived</span>
          </label>
          <div className="w-full md:w-[340px]">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search claims…" />
          </div>
        </div>

        <div className="space-y-2">
          {filtered.map((c) => (
            <div key={c.id} className="flex items-center justify-between surface-soft px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  Claim #{c.id} • {c.status}
                  {c.archived_at ? <span className="ml-2 text-xs muted">(archived)</span> : null}
                </div>
                <div className="text-xs muted">deal {c.deal_id} • deliverable {c.deliverable_id} • {c.reason}</div>
              </div>
              <Link className="text-sm link-accent" to={`/claims/${c.id}`}>
                Open →
              </Link>
            </div>
          ))}
          {filtered.length === 0 ? <div className="text-sm muted">No claims found.</div> : null}
        </div>
      </CardBody>
    </Card>
  );
}