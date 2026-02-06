import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { Card, CardBody, CardHeader } from "../components/Card";
import { Link } from "react-router-dom";
import { Badge } from "../components/Badge";
import { Input } from "../components/Input";

type Ticket = { id: number; subject: string; status: string; created_at: string; archived_at?: string | null; priority?: string };

export function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [q, setQ] = useState("");

  async function refresh() {
    const orgs = await api.listOrgs();
    const orgId = orgs?.[0]?.id;
    if (!orgId) return;
    const t = await api.listTickets(orgId, includeArchived);
    setTickets(t);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeArchived]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return tickets;
    return tickets.filter((t) => `${t.id} ${t.subject} ${t.status} ${t.priority || ""}`.toLowerCase().includes(qq));
  }, [tickets, q]);

  const activeCount = tickets.filter((t) => !t.archived_at).length;
  const archivedCount = tickets.filter((t) => !!t.archived_at).length;

  return (
    <Card>
      <CardHeader
        title="Support Desk"
        subtitle="All sponsor tickets in one inbox"
        right={
          <div className="flex items-center gap-2">
            <Badge tone="blue">{activeCount} active</Badge>
            {includeArchived ? <Badge tone="neutral">{archivedCount} archived</Badge> : null}
          </div>
        }
      />
      <CardBody>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
              <span className="muted">Show archived</span>
            </label>
          </div>
          <div className="w-full md:w-[340px]">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tickets…" />
          </div>
        </div>

        <div className="space-y-2">
          {filtered.map((t) => (
            <div key={t.id} className="flex items-center justify-between surface-soft px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  #{t.id} {t.subject}
                  {t.archived_at ? <span className="ml-2 text-xs muted">(archived)</span> : null}
                </div>
                <div className="text-xs muted">
                  {t.status}
                  {t.priority ? ` • ${t.priority}` : ""} • {t.created_at}
                </div>
              </div>
              <Link className="text-sm link-accent" to={`/tickets/${t.id}`}>
                Open →
              </Link>
            </div>
          ))}
          {filtered.length === 0 ? <div className="text-sm muted">No tickets found.</div> : null}
        </div>
      </CardBody>
    </Card>
  );
}