import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { Card, CardBody, CardHeader } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Badge } from "../components/Badge";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { useToast } from "../components/Toast";
import { useUnsavedChangesGuard } from "../lib/useUnsavedChangesGuard";

type Sponsor = {
  id: number;
  organization_id: number;
  name: string;
  contact_email?: string | null;
  portal_token: string;
  archived_at?: string | null;
};

type Deal = {
  id: number;
  name: string;
  portal_token: string;
  guarantee_cap_pct: number;
  cure_days: number;
  start_date: string;
  end_date: string;
  archived_at?: string | null;
};

export function SponsorDetailPage() {
  const { sponsorId } = useParams();
  const sid = Number(sponsorId);
  const toast = useToast();

  const [sponsor, setSponsor] = useState<Sponsor | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  // sponsor edit
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // create deal
  const [dealName, setDealName] = useState("");
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(new Date(Date.now() + 28 * 86400000).toISOString().slice(0, 10));
  const [cap, setCap] = useState("0.15");
  const [cure, setCure] = useState("5");

  const sponsorDirty = useMemo(() => {
    if (!edit) return false;
    return (
      (name || "").trim() !== (sponsor?.name || "").trim() ||
      (email || "").trim() !== ((sponsor?.contact_email || "") as string).trim()
    );
  }, [edit, name, email, sponsor]);
  useUnsavedChangesGuard(sponsorDirty);

  async function refresh() {
    const s: Sponsor = await api.getSponsor(sid);
    setSponsor(s);
    setName(s.name || "");
    setEmail((s.contact_email || "") as string);
    const d: Deal[] = await api.listDeals(sid, showArchived);
    setDeals(d);
  }

  useEffect(() => {
    refresh().catch((e) => alert(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid, showArchived]);

  const isArchived = !!sponsor?.archived_at;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Dashboard", to: "/" }, { label: `Org #${sponsor?.organization_id ?? "?"}`, to: sponsor?.organization_id ? `/org/${sponsor.organization_id}` : "/" }, { label: sponsor?.name || `Sponsor #${sid}` }]}
        backTo={sponsor?.organization_id ? `/org/${sponsor.organization_id}` : "/"}
        backLabel="Organization"
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm muted">Sponsor</div>
          <div className="text-2xl font-semibold">{sponsor?.name || `Sponsor #${sid}`}</div>
          {isArchived ? <div className="mt-1 text-sm muted">Archived</div> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {!edit ? (
            <Button variant="secondary" onClick={() => setEdit(true)}>Edit</Button>
          ) : (
            <>
              <Button
                variant="primary"
                disabled={!sponsorDirty}
                onClick={async () => {
                  try {
                    await api.updateSponsor(sid, { name, contact_email: email || null });
                    setEdit(false);
                    toast.push({ title: "Sponsor updated" });
                    await refresh();
                  } catch (e: any) {
                    alert(e.message);
                  }
                }}
              >
                Save
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setName(sponsor?.name || "");
                  setEmail((sponsor?.contact_email || "") as string);
                  setEdit(false);
                }}
              >
                Cancel
              </Button>
            </>
          )}

          {!isArchived ? (
            <Button
              variant="secondary"
              onClick={async () => {
                if (!confirm("Archive this sponsor? (You can restore later)")) return;
                await api.archiveSponsor(sid);
                toast.push({
                  title: "Sponsor archived",
                  actionLabel: "Undo",
                  onAction: async () => {
                    await api.restoreSponsor(sid);
                    await refresh();
                  },
                });
                await refresh();
              }}
            >
              Archive
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={async () => {
                await api.restoreSponsor(sid);
                toast.push({ title: "Sponsor restored" });
                await refresh();
              }}
            >
              Restore
            </Button>
          )}
        </div>
      </div>

      {edit ? (
        <Card>
          <CardHeader title="Edit sponsor" subtitle="Name + contact email" />
          <CardBody>
            <div className="grid gap-2 md:grid-cols-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sponsor name" />
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Contact email (optional)" />
            </div>
            <div className="mt-3 text-xs muted">
              Sponsor portal token: <span className="font-mono text-slate-900 dark:text-white">{sponsor?.portal_token || "—"}</span>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="text-xs muted">
          Sponsor portal token: <span className="font-mono text-slate-900 dark:text-white">{sponsor?.portal_token || "—"}</span>
        </div>
      )}

      <Card>
        <CardHeader
          title="Deals"
          subtitle="Create, edit, archive & restore (no hard delete)"
          right={<Badge tone="blue">{deals.length} shown</Badge>}
        />
        <CardBody>
          <div className="grid gap-2 md:grid-cols-7">
            <div className="md:col-span-2"><Input value={dealName} onChange={(e) => setDealName(e.target.value)} placeholder="Deal name" /></div>
            <Input value={start} onChange={(e) => setStart(e.target.value)} type="date" />
            <Input value={end} onChange={(e) => setEnd(e.target.value)} type="date" />
            <Input value={cap} onChange={(e) => setCap(e.target.value)} placeholder="cap (0.15)" />
            <Input value={cure} onChange={(e) => setCure(e.target.value)} placeholder="cure days" />
            <Button
              variant="primary"
              onClick={async () => {
                try {
                  await api.createDeal({
                    sponsor_id: sid,
                    name: dealName || "New deal",
                    start_date: start,
                    end_date: end,
                    guarantee_cap_pct: Number(cap),
                    cure_days: Number(cure),
                  });
                  setDealName("");
                  toast.push({ title: "Deal created" });
                  await refresh();
                } catch (e: any) {
                  alert(e.message);
                }
              }}
            >
              Create
            </Button>
          </div>

          <div className="mt-3">
            <label className="surface-soft px-3 py-2 rounded-2xl text-sm inline-flex items-center gap-2">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Show archived
            </label>
          </div>

          <div className="mt-4 space-y-2">
            {deals.map((d) => {
              const dealArchived = !!d.archived_at;
              return (
                <div key={d.id} className="surface p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {dealArchived ? <Badge tone="neutral">archived</Badge> : null}
                        <div className="text-sm font-semibold">{d.name}</div>
                      </div>
                      <div className="text-xs muted">{d.start_date} → {d.end_date}</div>
                      <div className="mt-2 flex gap-2">
                        <Badge tone="blue">cap {Math.round(d.guarantee_cap_pct * 100)}%</Badge>
                        <Badge tone="yellow">cure {d.cure_days}d</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link className="text-sm link-accent" to={`/deal/${d.id}`}>Open →</Link>
                      {!dealArchived ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            if (!confirm("Archive this deal? (You can restore later)")) return;
                            await api.archiveDeal(d.id);
                            toast.push({
                              title: "Deal archived",
                              actionLabel: "Undo",
                              onAction: async () => {
                                await api.unarchiveDeal(d.id);
                                await refresh();
                              },
                            });
                            await refresh();
                          }}
                        >
                          Archive
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={async () => {
                            await api.unarchiveDeal(d.id);
                            toast.push({ title: "Deal restored" });
                            await refresh();
                          }}
                        >
                          Restore
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 text-xs muted">
                    Deal portal token: <span className="font-mono text-slate-900 dark:text-white">{d.portal_token}</span>
                  </div>
                </div>
              );
            })}
            {deals.length === 0 ? <div className="text-sm muted">No deals yet.</div> : null}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}