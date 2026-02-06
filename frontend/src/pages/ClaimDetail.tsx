import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { Card, CardBody, CardHeader } from "../components/Card";
import { Input, Textarea } from "../components/Input";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { useToast } from "../components/Toast";
import { useUnsavedChangesGuard } from "../lib/useUnsavedChangesGuard";

type Claim = {
  id: number;
  deal_id: number;
  deliverable_id: number;
  reason: string;
  description?: string | null;
  status: "submitted" | "approved" | "denied" | "paid" | string;
  payout_type?: string | null;
  payout_amount?: number | null;
  notes?: string | null;
  archived_at?: string | null;
};

export function ClaimDetailPage() {
  const { claimId } = useParams();
  const id = Number(claimId);
  const toast = useToast();

  const [claim, setClaim] = useState<Claim | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [status, setStatus] = useState<string>("submitted");
  const [payoutType, setPayoutType] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  async function refresh() {
    const orgs = await api.listOrgs();
    const orgId = orgs?.[0]?.id;
    if (!orgId) return;

    const list = await api.listClaims(orgId, true);
    const c = list.find((x: any) => x.id === id) || null;
    setClaim(c);

    if (c && !editMode) {
      setStatus(c.status || "submitted");
      setPayoutType(c.payout_type || "");
      setAmount(c.payout_amount == null ? "" : String(c.payout_amount));
      setNotes(c.notes || "");
    }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [id]);

  useEffect(() => {
    if (!claim) return;
    if (!editMode) {
      setStatus(claim.status || "submitted");
      setPayoutType(claim.payout_type || "");
      setAmount(claim.payout_amount == null ? "" : String(claim.payout_amount));
      setNotes(claim.notes || "");
    }
  }, [claim?.id, editMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = useMemo(() => {
    if (!claim) return false;
    const amt = amount.trim() === "" ? null : Number(amount);
    return (
      status !== (claim.status || "submitted") ||
      payoutType !== (claim.payout_type || "") ||
      (Number.isNaN(amt) ? claim.payout_amount != null : amt !== (claim.payout_amount ?? null)) ||
      notes !== (claim.notes || "")
    );
  }, [claim, status, payoutType, amount, notes]);

  useUnsavedChangesGuard(editMode && isDirty);

  async function quickStatus(s: string) {
    await api.updateClaim(id, { status: s });
    toast.push({ title: "Status updated", message: `Claim set to ${s}.` });
    await refresh();
  }

  async function save() {
    const payload: any = {
      status,
      payout_type: payoutType || null,
      payout_amount: amount.trim() === "" ? null : Number(amount),
      notes: notes || null,
    };
    await api.updateClaim(id, payload);
    setEditMode(false);
    toast.push({ title: "Saved", message: "Claim updated." });
    await refresh();
  }

  function cancel() {
    if (isDirty && !window.confirm("Discard changes?")) return;
    setEditMode(false);
    if (claim) {
      setStatus(claim.status || "submitted");
      setPayoutType(claim.payout_type || "");
      setAmount(claim.payout_amount == null ? "" : String(claim.payout_amount));
      setNotes(claim.notes || "");
    }
  }

  async function archive() {
    if (!window.confirm("Archive this claim? You can restore it later.")) return;
    await api.archiveClaim(id);
    toast.push({
      title: "Claim archived",
      message: `Claim #${id} was archived.`,
      actionLabel: "Undo",
      onAction: async () => { await api.restoreClaim(id); await refresh(); },
    });
    await refresh();
  }

  async function restore() {
    await api.restoreClaim(id);
    toast.push({ title: "Claim restored", message: `Claim #${id} is active again.` });
    await refresh();
  }

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[
          { label: "Dashboard", to: "/" },
          { label: "Claims", to: "/claims" },
          { label: `#${id}` },
        ]}
        backTo="/claims"
        backLabel="Claims"
      />

      <Card>
        <CardHeader
          title={`Claim #${id}`}
          subtitle={claim ? `deal ${claim.deal_id} • deliverable ${claim.deliverable_id}` : ""}
          right={claim ? (
            <div className="flex items-center gap-2">
              <Badge tone={claim.status === "paid" ? "neutral" : claim.status === "denied" ? "red" : claim.status === "approved" ? "green" : "blue"}>
                {claim.status}
              </Badge>
              {claim.archived_at ? <Badge tone="neutral">archived</Badge> : null}
            </div>
          ) : null}
        />
        <CardBody>
          {!claim ? (
            <div className="text-sm muted">Loading…</div>
          ) : (
            <div className="space-y-4">
              <div className="surface-soft p-3">
                <div className="text-xs muted mb-1">Reason</div>
                <div className="text-sm">{claim.reason}</div>
                <div className="mt-2 text-xs muted mb-1">Description</div>
                <div className="text-sm whitespace-pre-wrap">{claim.description || "—"}</div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant={claim.status === "submitted" ? "primary" : "secondary"} onClick={() => quickStatus("submitted")}>Submitted</Button>
                  <Button size="sm" variant={claim.status === "approved" ? "primary" : "secondary"} onClick={() => quickStatus("approved")}>Approve</Button>
                  <Button size="sm" variant={claim.status === "denied" ? "primary" : "secondary"} onClick={() => quickStatus("denied")}>Deny</Button>
                  <Button size="sm" variant={claim.status === "paid" ? "primary" : "secondary"} onClick={() => quickStatus("paid")}>Paid</Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!claim.archived_at ? (
                    <Button size="sm" variant="danger" onClick={archive}>Archive</Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={restore}>Restore</Button>
                  )}
                  {!editMode ? (
                    <Button size="sm" variant="secondary" onClick={() => setEditMode(true)}>Edit</Button>
                  ) : (
                    <>
                      <Button size="sm" variant="primary" onClick={save} disabled={!isDirty}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={cancel}>Cancel</Button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-4">
                <div className="md:col-span-1">
                  <div className="text-xs muted mb-1">Status</div>
                  <select
                    disabled={!editMode}
                    className="w-full surface-soft rounded-xl px-3 py-2 text-sm disabled:opacity-60"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="submitted">submitted</option>
                    <option value="approved">approved</option>
                    <option value="denied">denied</option>
                    <option value="paid">paid</option>
                  </select>
                </div>

                <div className="md:col-span-1">
                  <div className="text-xs muted mb-1">Payout type</div>
                  <select
                    disabled={!editMode}
                    className="w-full surface-soft rounded-xl px-3 py-2 text-sm disabled:opacity-60"
                    value={payoutType}
                    onChange={(e) => setPayoutType(e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="credit">credit</option>
                    <option value="refund">refund</option>
                    <option value="make_good">make_good</option>
                  </select>
                </div>

                <div className="md:col-span-1">
                  <div className="text-xs muted mb-1">Amount</div>
                  <Input disabled={!editMode} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 300" />
                </div>

                <div className="md:col-span-1 flex items-end">
                  {editMode ? (
                    <Button variant="primary" onClick={save} disabled={!isDirty} className="w-full">Save</Button>
                  ) : (
                    <Button variant="secondary" onClick={() => setEditMode(true)} className="w-full">Edit fields</Button>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs muted mb-1">Notes</div>
                <Textarea
                  rows={4}
                  disabled={!editMode}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes…"
                />
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}