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

type Org = { id: number; name: string };
type Sponsor = { id: number; name: string; contact_email?: string; portal_token: string; archived_at?: string | null };

export function OrgDetailPage() {
  const { orgId } = useParams();
  const oid = Number(orgId);
  const toast = useToast();

  const [org, setOrg] = useState<Org | null>(null);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  // Org edit
  const [editOrg, setEditOrg] = useState(false);
  const [orgName, setOrgName] = useState("");

  // Create sponsor
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const dirty = useMemo(() => {
    if (!editOrg) return false;
    return (orgName || "").trim() !== (org?.name || "").trim();
  }, [editOrg, orgName, org]);
  useUnsavedChangesGuard(dirty);

  async function refresh() {
    const o = await api.getOrg(oid);
    setOrg(o);
    setOrgName(o?.name || "");
    const list = await api.listSponsors(oid, showArchived);
    setSponsors(list);
  }

  useEffect(() => {
    refresh().catch((e) => alert(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oid, showArchived]);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: "Dashboard", to: "/" }, { label: org?.name ? org.name : `Org #${oid}` }]}
        backTo="/"
        backLabel="Dashboard"
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm muted">Organization</div>
          <div className="text-2xl font-semibold">{org?.name || `Org #${oid}`}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!editOrg ? (
            <Button variant="secondary" onClick={() => setEditOrg(true)}>Edit</Button>
          ) : (
            <>
              <Button
                variant="primary"
                disabled={!dirty}
                onClick={async () => {
                  try {
                    await api.updateOrg(oid, { name: orgName });
                    setEditOrg(false);
                    toast.push({ title: "Organization updated" });
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
                  setOrgName(org?.name || "");
                  setEditOrg(false);
                }}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {editOrg ? (
        <Card>
          <CardHeader title="Edit organization" subtitle="Rename (pilot-safe)" />
          <CardBody>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Organization name" />
              <div className="text-xs muted">Only org admins can rename.</div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Sponsors"
          subtitle="Create, edit, archive & restore (no hard delete)"
          right={<Badge tone="blue">{sponsors.length} shown</Badge>}
        />
        <CardBody>
          <div className="mb-4 grid gap-2 md:grid-cols-4">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Sponsor name" />
            <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Contact email (optional)" />
            <Button
              onClick={async () => {
                try {
                  await api.createSponsor(oid, newName || "Sponsor", newEmail || undefined);
                  setNewName("");
                  setNewEmail("");
                  toast.push({ title: "Sponsor created" });
                  await refresh();
                } catch (e: any) {
                  alert(e.message);
                }
              }}
            >
              Create Sponsor
            </Button>
            <label className="surface-soft px-3 py-2 rounded-2xl text-sm flex items-center gap-2">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Show archived
            </label>
          </div>

          <div className="space-y-2">
            {sponsors.map((s) => {
              const isArchived = !!s.archived_at;
              return (
                <div key={s.id} className="surface p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {isArchived ? <Badge tone="neutral">archived</Badge> : null}
                        <div className="text-sm font-semibold">{s.name}</div>
                      </div>
                      <div className="text-xs muted">{s.contact_email || "—"}</div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Link className="text-sm link-accent" to={`/sponsor/${s.id}`}>Open →</Link>
                      {!isArchived ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            if (!confirm("Archive this sponsor? (You can restore later)") ) return;
                            await api.archiveSponsor(s.id);
                            toast.push({
                              title: "Sponsor archived",
                              actionLabel: "Undo",
                              onAction: async () => {
                                await api.restoreSponsor(s.id);
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
                            await api.restoreSponsor(s.id);
                            toast.push({ title: "Sponsor restored" });
                            await refresh();
                          }}
                        >
                          Restore
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 text-xs muted">
                    Sponsor portal token: <span className="font-mono text-slate-900 dark:text-white">{s.portal_token}</span>
                  </div>
                </div>
              );
            })}
            {sponsors.length === 0 ? <div className="text-sm muted">No sponsors yet.</div> : null}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}