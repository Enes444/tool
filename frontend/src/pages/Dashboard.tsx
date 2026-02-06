import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { Card, CardBody, CardHeader } from "../components/Card";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, LifeBuoy, ShieldCheck, Sparkles } from "lucide-react";

type Org = { id: number; name: string };

type Activity = { id: number; created_at?: string; actor?: string | null; action: string; entity_type?: string | null; entity_id?: number | null; summary?: string | null };

export function DashboardPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [activeOrgId, setActiveOrgId] = useState<number | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [ticketCount, setTicketCount] = useState<number | null>(null);
  const [claimCount, setClaimCount] = useState<number | null>(null);

  async function refresh() {
    setErr(null);
    try {
      const data = await api.listOrgs();
      setOrgs(data);
      if (data.length && !activeOrgId) setActiveOrgId(data[0].id);
    } catch (e: any) {
      setErr(e.message || "Failed to load orgs");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    (async () => {
      if (!activeOrgId) return;
      try {
        const [a, t, c] = await Promise.all([
          api.listActivity(activeOrgId),
          api.listTickets(activeOrgId),
          api.listClaims(activeOrgId),
        ]);
        setActivity(a?.slice?.(0, 8) ?? []);
        setTicketCount(Array.isArray(t) ? t.length : 0);
        setClaimCount(Array.isArray(c) ? c.length : 0);
      } catch {
        // keep dashboard resilient in pilot mode
        setActivity([]);
      }
    })();
  }, [activeOrgId]);

  return (
    <div className="space-y-6">
      <div className="surface p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border hairline bg-white/60 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-white/5 dark:text-white/80">
              <Sparkles size={14} /> Operations workspace
            </div>
            <h1 className="text-2xl font-semibold">Inbox</h1>
            <p className="muted">
              Start your day here: triage tickets, decide claims, and review delivery activity.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link to="/tickets">
              <Button variant="secondary">
                <span className="inline-flex items-center gap-2"><LifeBuoy size={16} /> Inbox</span>
              </Button>
            </Link>
            <Link to="/claims">
              <Button>
                <span className="inline-flex items-center gap-2"><ShieldCheck size={16} /> Claims</span>
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="surface-soft p-3">
            <div className="text-xs muted">Organizations</div>
            <div className="mt-1 flex items-end justify-between">
              <div className="text-2xl font-semibold">{orgs.length}</div>
              <Building2 size={18} className="text-slate-400 dark:text-white/40" />
            </div>
          </div>
          <div className="surface-soft p-3">
            <div className="text-xs muted">Tickets</div>
            <div className="mt-1 flex items-end justify-between">
              <div className="text-2xl font-semibold">{ticketCount ?? "–"}</div>
              <span className="text-xs muted">for selected org</span>
            </div>
          </div>
          <div className="surface-soft p-3">
            <div className="text-xs muted">Claims</div>
            <div className="mt-1 flex items-end justify-between">
              <div className="text-2xl font-semibold">{claimCount ?? "–"}</div>
              <span className="text-xs muted">for selected org</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Organizations"
            subtitle="Your properties / teams / agencies"
            right={<Badge tone="blue">{orgs.length} total</Badge>}
          />
          <CardBody>
            {err ? <div className="mb-3 text-sm text-rose-600 dark:text-rose-300">{err}</div> : null}

            <div className="space-y-2">
              {orgs.map((o) => (
                <div key={o.id} className="flex flex-col gap-2 surface-soft px-3 py-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-medium">{o.name}</div>
                    <div className="text-xs muted">Org ID: {o.id}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={activeOrgId === o.id ? "primary" : "secondary"}
                      onClick={() => setActiveOrgId(o.id)}
                    >
                      {activeOrgId === o.id ? "Selected" : "Select"}
                    </Button>
                    <Link className="text-sm link-accent" to={`/org/${o.id}`}>
                      Open <ArrowRight size={14} className="inline" />
                    </Link>
                  </div>
                </div>
              ))}
              {orgs.length === 0 ? <div className="text-sm muted">No organizations yet. Create one in Settings.</div> : null}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent activity" subtitle={activeOrgId ? `Org ${activeOrgId}` : "Pick an org"} />
          <CardBody>
            {activeOrgId ? (
              <div className="space-y-2">
                {activity.map((a) => (
                  <div key={a.id} className="surface-soft px-3 py-2">
                    <div className="text-xs font-semibold text-slate-800 dark:text-white">
                      {a.action}
                    </div>
                    <div className="text-xs muted">{a.summary || a.entity_type || ""}</div>
                  </div>
                ))}
                {activity.length === 0 ? (
                  <div className="text-sm muted">No activity yet. Create a sponsor/deal to generate events.</div>
                ) : null}
              </div>
            ) : (
              <div className="text-sm muted">Select an org to see activity.</div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Tickets" subtitle="Support desk inbox (admin)" />
          <CardBody>
            <div className="flex items-center justify-between">
              <div className="text-sm muted">Triage sponsor requests and unblock delivery.</div>
              <Link className="text-sm link-accent" to="/tickets">
                Open <ArrowRight size={14} className="inline" />
              </Link>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Claims" subtitle="Guaranteed delivery workflow (admin)" />
          <CardBody>
            <div className="flex items-center justify-between">
              <div className="text-sm muted">Approve/deny claims with proof attached.</div>
              <Link className="text-sm link-accent" to="/claims">
                Open <ArrowRight size={14} className="inline" />
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}