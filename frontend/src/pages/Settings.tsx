import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Card, CardBody, CardHeader } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";

type Org = { id: number; name: string };

export function SettingsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try { setErr(null); setOrgs(await api.listOrgs()); }
    catch (e: any) { setErr(e.message || "Failed to load organizations"); }
  }
  useEffect(() => { refresh(); }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card>
        <CardHeader title="Organization setup" subtitle="Create or rename organizations. Daily operations happen in Inbox, Deals and Portal." />
        <CardBody>
          {err ? <div className="mb-3 text-sm text-rose-600 dark:text-rose-300">{err}</div> : null}
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New organization name" />
            <Button onClick={async () => { if(!name.trim()) return; await api.createOrg(name.trim()); setName(""); await refresh(); }}>Create</Button>
          </div>
          <div className="space-y-2">
            {orgs.map((o) => (
              <div key={o.id} className="surface-soft px-3 py-2 text-sm flex items-center justify-between">
                <span>{o.name}</span><span className="muted text-xs">ID: {o.id}</span>
              </div>
            ))}
            {orgs.length === 0 ? <div className="text-sm muted">No organizations yet.</div> : null}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}