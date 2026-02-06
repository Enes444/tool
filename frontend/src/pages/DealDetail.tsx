import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { Card, CardBody, CardHeader } from "../components/Card";
import { Button } from "../components/Button";
import { Input, Textarea } from "../components/Input";
import { Badge } from "../components/Badge";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { useToast } from "../components/Toast";
import { useUnsavedChangesGuard } from "../lib/useUnsavedChangesGuard";

type Deal = {
  id: number;
  sponsor_id: number;
  name: string;
  portal_token: string;
  guarantee_cap_pct: number;
  cure_days: number;
  start_date: string;
  end_date: string;
  status?: string;
  archived_at?: string | null;
};

type Sponsor = {
  id: number;
  organization_id: number;
  name: string;
};

type Deliverable = {
  id: number;
  title: string;
  type: string;
  due_date: string;
  status: string;
  guaranteed: boolean;
  value?: number;
  owner?: string | null;
  sponsor_approval_required?: boolean;
  sponsor_approved_at?: string | null;
  sponsor_approved_by?: string | null;
  brief?: string | null;
  archived_at?: string | null;
  canceled_at?: string | null;
};

type Proof = {
  id: number;
  kind: "link" | "file";
  url?: string | null;
  note?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  created_at: string;
};

type Comment = {
  id: number;
  author: string;
  body: string;
  created_at: string;
};

type BrandKit = {
  guidelines_md: string;
  hashtags: string[];
  required_tags: string[];
  do: string[];
  dont: string[];
  assets: { name: string; url: string }[];
  updated_at?: string;
};

type Activity = {
  id: number;
  created_at: string;
  entity_type: string;
  action: string;
  summary: string;
  actor?: string | null;
};

const STATUS_OPTIONS = [
  "draft",
  "internal_review",
  "sponsor_review",
  "approved",
  "scheduled",
  "posted",
  "proofed",
  "delivered",
  "late",
  "canceled",
];

function toneForStatus(s: string) {
  if (s === "delivered") return "green";
  if (s === "late" || s === "overdue") return "red";
  if (s === "sponsor_review" || s === "internal_review") return "yellow";
  if (s === "approved" || s === "scheduled") return "blue";
  return "neutral";
}

function parseCSV(s: string) {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseLines(s: string) {
  return s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

function fmtDt(dt?: string | null) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function TabButton({ active, children, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={
        "px-3 py-2 rounded-xl text-sm font-medium transition " +
        (active
          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
          : "text-slate-600 hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10")
      }
    >
      {children}
    </button>
  );
}

export function DealDetailPage() {
  const { dealId } = useParams();
  const did = Number(dealId);
  const toast = useToast();

  const [deal, setDeal] = useState<Deal | null>(null);
  const [sponsor, setSponsor] = useState<Sponsor | null>(null);
  const [orgId, setOrgId] = useState<number | null>(null);

  const [tab, setTab] = useState<"deliverables" | "proofs" | "brandkit" | "comments" | "activity">("deliverables");

  const [items, setItems] = useState<Deliverable[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [showArchived, setShowArchived] = useState(false);

  // Deal edit
  const [editDeal, setEditDeal] = useState(false);
  const [dealName, setDealName] = useState("");
  const [dealStart, setDealStart] = useState("");
  const [dealEnd, setDealEnd] = useState("");
  const [dealCap, setDealCap] = useState("0");
  const [dealCure, setDealCure] = useState("0");

  // Deliverable edit (inline)
  const [editDeliverableId, setEditDeliverableId] = useState<number | null>(null);
  const [dTitle, setDTitle] = useState("");
  const [dType, setDType] = useState("");
  const [dDue, setDDue] = useState("");
  const [dOwner, setDOwner] = useState("");
  const [dValue, setDValue] = useState("");
  const [dBrief, setDBrief] = useState("");
  const [dGuaranteed, setDGuaranteed] = useState(false);
  const [dApproval, setDApproval] = useState(false);

  // Create deliverable form
  const [newTitle, setNewTitle] = useState("TikTok #1");
  const [newType, setNewType] = useState("tiktok");
  const [newDue, setNewDue] = useState(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
  const [newGuaranteed, setNewGuaranteed] = useState(true);
  const [newValue, setNewValue] = useState("300");
  const [newOwner, setNewOwner] = useState("Content");
  const [newApproval, setNewApproval] = useState(false);
  const [newBrief, setNewBrief] = useState("");

  // Proofs
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [proofUrl, setProofUrl] = useState("https://example.com/post");
  const [proofNote, setProofNote] = useState("Posted 18:00 CET, includes CTA + tag");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNote, setUploadNote] = useState("");

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");

  // BrandKit
  const [brandkit, setBrandkit] = useState<BrandKit | null>(null);
  const [bkGuidelines, setBkGuidelines] = useState("");
  const [bkHashtags, setBkHashtags] = useState("#ad, #partner");
  const [bkReqTags, setBkReqTags] = useState("@brand");
  const [bkDo, setBkDo] = useState("Mention CTA\nShow logo clearly");
  const [bkDont, setBkDont] = useState("Make performance claims\nUse competitor names");
  const [bkAssets, setBkAssets] = useState<Array<{ name: string; url: string }>>([{ name: "Logo", url: "" }]);

  // Activity
  const [activity, setActivity] = useState<Activity[]>([]);

  const selected = useMemo(() => items.find((x) => x.id === selectedId) || null, [items, selectedId]);

  const dealDirty = useMemo(() => {
    if (!editDeal || !deal) return false;
    return (
      dealName.trim() !== (deal.name || "").trim() ||
      dealStart !== deal.start_date ||
      dealEnd !== deal.end_date ||
      Number(dealCap) !== Number(deal.guarantee_cap_pct) ||
      Number(dealCure) !== Number(deal.cure_days)
    );
  }, [editDeal, deal, dealName, dealStart, dealEnd, dealCap, dealCure]);

  const deliverableDirty = useMemo(() => {
    if (!editDeliverableId) return false;
    const orig = items.find((x) => x.id === editDeliverableId);
    if (!orig) return false;
    return (
      dTitle.trim() !== (orig.title || "").trim() ||
      dType.trim() !== (orig.type || "").trim() ||
      dDue !== orig.due_date ||
      (dOwner || "").trim() !== ((orig.owner || "") as string).trim() ||
      (dValue ? Number(dValue) : null) !== (orig.value ?? null) ||
      (dBrief || "") !== (orig.brief || "") ||
      dGuaranteed !== !!orig.guaranteed ||
      dApproval !== !!orig.sponsor_approval_required
    );
  }, [editDeliverableId, items, dTitle, dType, dDue, dOwner, dValue, dBrief, dGuaranteed, dApproval]);

  useUnsavedChangesGuard(dealDirty || deliverableDirty);

  async function refreshCore() {
    const d: Deal = await api.getDeal(did);
    setDeal(d);
    // keep edit defaults in sync when not editing
    if (!editDeal) {
      setDealName(d.name || "");
      setDealStart(d.start_date || "");
      setDealEnd(d.end_date || "");
      setDealCap(String(d.guarantee_cap_pct ?? 0));
      setDealCure(String(d.cure_days ?? 0));
    }
    const s: Sponsor = await api.getSponsor(d.sponsor_id);
    setSponsor(s);
    setOrgId(s.organization_id);
    const list: Deliverable[] = await api.listDeliverables(did, showArchived);
    setItems(list);
    if (!selectedId && list.length) setSelectedId(list[0].id);
  }

  async function refreshProofs(deliverableId: number) {
    const p: Proof[] = await api.listProofs(deliverableId);
    setProofs(p);
  }

  async function refreshComments(deliverableId: number) {
    const c: Comment[] = await api.listComments(deliverableId);
    setComments(c);
  }

  async function refreshBrandkit() {
    const bk = await api.getBrandKit(did);
    setBrandkit(bk);
    setBkGuidelines(bk.guidelines_md || "");
    setBkHashtags((bk.hashtags || []).join(", "));
    setBkReqTags((bk.required_tags || []).join(", "));
    setBkDo((bk.do || []).join("\n"));
    setBkDont((bk.dont || []).join("\n"));
    setBkAssets(Array.isArray(bk.assets) && bk.assets.length ? bk.assets : [{ name: "Logo", url: "" }]);
  }

  async function refreshActivity() {
    if (!orgId) return;
    const a: Activity[] = await api.listActivity(orgId, did);
    setActivity(a);
  }

  useEffect(() => {
    refreshCore().catch((e) => alert(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [did, showArchived]);

  useEffect(() => {
    if (!selectedId) return;
    if (tab === "proofs") refreshProofs(selectedId).catch((e) => alert(e.message));
    if (tab === "comments") refreshComments(selectedId).catch((e) => alert(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedId]);

  useEffect(() => {
    if (tab === "brandkit") refreshBrandkit().catch((e) => alert(e.message));
    if (tab === "activity") refreshActivity().catch((e) => alert(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, orgId]);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", to: "/" },
          sponsor?.organization_id ? { label: `Org #${sponsor.organization_id}`, to: `/org/${sponsor.organization_id}` } : { label: "Org", to: "/" },
          sponsor ? { label: sponsor.name, to: `/sponsor/${sponsor.id}` } : { label: "Sponsor" },
          { label: deal?.name || `Deal #${did}` },
        ]}
        backTo={sponsor ? `/sponsor/${sponsor.id}` : "/"}
        backLabel="Sponsor"
      />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm muted">Deal</div>
          <div className="text-2xl font-semibold">{deal?.name || `Deal #${did}`}</div>
          {deal && sponsor ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="blue">{sponsor.name}</Badge>
              <Badge tone="neutral">{deal.start_date} → {deal.end_date}</Badge>
              <Badge tone="blue">cap {Math.round(deal.guarantee_cap_pct * 100)}%</Badge>
              <Badge tone="yellow">cure {deal.cure_days}d</Badge>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {!editDeal ? (
            <Button
              variant="secondary"
              onClick={() => {
                if (!deal) return;
                setDealName(deal.name || "");
                setDealStart(deal.start_date || "");
                setDealEnd(deal.end_date || "");
                setDealCap(String(deal.guarantee_cap_pct ?? 0));
                setDealCure(String(deal.cure_days ?? 0));
                setEditDeal(true);
              }}
            >
              Edit
            </Button>
          ) : (
            <>
              <Button
                variant="primary"
                disabled={!dealDirty}
                onClick={async () => {
                  try {
                    await api.updateDeal(did, {
                      name: dealName,
                      start_date: dealStart,
                      end_date: dealEnd,
                      guarantee_cap_pct: Number(dealCap),
                      cure_days: Number(dealCure),
                    });
                    setEditDeal(false);
                    toast.push({ title: "Deal updated" });
                    await refreshCore();
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
                  setEditDeal(false);
                  if (deal) {
                    setDealName(deal.name || "");
                    setDealStart(deal.start_date || "");
                    setDealEnd(deal.end_date || "");
                    setDealCap(String(deal.guarantee_cap_pct ?? 0));
                    setDealCure(String(deal.cure_days ?? 0));
                  }
                }}
              >
                Cancel
              </Button>
            </>
          )}

          {deal ? (
            deal.archived_at ? (
              <Button
                variant="primary"
                onClick={async () => {
                  await api.unarchiveDeal(did);
                  toast.push({ title: "Deal restored" });
                  await refreshCore();
                }}
              >
                Restore
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={async () => {
                  if (!confirm("Archive this deal? (You can restore later)")) return;
                  await api.archiveDeal(did);
                  toast.push({
                    title: "Deal archived",
                    actionLabel: "Undo",
                    onAction: async () => {
                      await api.unarchiveDeal(did);
                      await refreshCore();
                    },
                  });
                  await refreshCore();
                }}
              >
                Archive
              </Button>
            )
          ) : null}

          <Button
            variant="secondary"
            onClick={async () => {
              if (!confirm("Apply Valorant standard template (adds 12 deliverables)?")) return;
              try {
                await api.applyTemplate(did, "valorant_standard");
                await refreshCore();
                alert("Template applied.");
              } catch (e: any) {
                alert(e.message);
              }
            }}
          >
            Apply Template
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              try {
                const buf = await api.dealPdf(did);
                const blob = new Blob([buf], { type: "application/pdf" });
                const url = URL.createObjectURL(blob);
                window.open(url, "_blank");
              } catch (e: any) {
                alert(e.message);
              }
            }}
          >
            Open PDF Report
          </Button>
          {deal ? (
            <a
              className="surface-soft px-3 py-2 text-sm link-accent rounded-xl"
              href={`/portal/deal/${deal.portal_token}`}
              target="_blank"
              rel="noreferrer"
            >
              Sponsor Portal →
            </a>
          ) : null}
          <Link className="surface-soft px-3 py-2 text-sm link-accent rounded-xl" to="/">Dashboard</Link>
        </div>
      </div>

      {editDeal ? (
        <Card>
          <CardHeader title="Edit deal" subtitle="Save/Cancel — no hard delete" />
          <CardBody>
            <div className="grid gap-2 md:grid-cols-5">
              <div className="md:col-span-2"><Input value={dealName} onChange={(e) => setDealName(e.target.value)} placeholder="Deal name" /></div>
              <Input value={dealStart} onChange={(e) => setDealStart(e.target.value)} type="date" />
              <Input value={dealEnd} onChange={(e) => setDealEnd(e.target.value)} type="date" />
              <div className="grid gap-2 md:grid-cols-2">
                <Input value={dealCap} onChange={(e) => setDealCap(e.target.value)} placeholder="cap (0.15)" />
                <Input value={dealCure} onChange={(e) => setDealCure(e.target.value)} placeholder="cure days" />
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 surface-soft p-2 rounded-2xl">
        <TabButton active={tab === "deliverables"} onClick={() => setTab("deliverables")}>Deliverables</TabButton>
        <TabButton active={tab === "proofs"} onClick={() => setTab("proofs")}>Proof Vault</TabButton>
        <TabButton active={tab === "brandkit"} onClick={() => setTab("brandkit")}>BrandKit</TabButton>
        <TabButton active={tab === "comments"} onClick={() => setTab("comments")}>Comments</TabButton>
        <TabButton active={tab === "activity"} onClick={() => setTab("activity")}>Activity</TabButton>
      </div>

      {/* Deliverables tab */}
      {tab === "deliverables" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader title="Add Deliverable" subtitle="Create scoped, trackable items" />
            <CardBody>
              <div className="space-y-2">
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Title" />
                <div className="grid gap-2 md:grid-cols-2">
                  <Input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="Type (tiktok, integration...)" />
                  <Input value={newDue} onChange={(e) => setNewDue(e.target.value)} type="date" />
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="Value (optional)" />
                  <Input value={newOwner} onChange={(e) => setNewOwner(e.target.value)} placeholder="Owner (e.g. Content)" />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-white/80">
                  <input type="checkbox" checked={newGuaranteed} onChange={(e) => setNewGuaranteed(e.target.checked)} /> Guaranteed
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-white/80">
                  <input type="checkbox" checked={newApproval} onChange={(e) => setNewApproval(e.target.checked)} /> Sponsor approval required
                </label>
                <Textarea value={newBrief} onChange={(e) => setNewBrief(e.target.value)} placeholder="Brief (optional)" rows={3} />
                <Button
                  variant="primary"
                  onClick={async () => {
                    try {
                      await api.createDeliverable(did, {
                        deal_id: did,
                        title: newTitle,
                        type: newType,
                        due_date: newDue,
                        owner: newOwner || null,
                        sponsor_approval_required: newApproval,
                        guaranteed: newGuaranteed,
                        value: newValue ? Number(newValue) : null,
                        brief: newBrief || null,
                      });
                      await refreshCore();
                      alert("Deliverable created.");
                    } catch (e: any) {
                      alert(e.message);
                    }
                  }}
                >
                  Create
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader
              title="Deliverables"
              subtitle="Status, approval, guarantees, deadlines"
              right={
                <div className="flex items-center gap-2">
                  <label className="surface-soft px-3 py-2 rounded-2xl text-sm flex items-center gap-2">
                    <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                    Show archived
                  </label>
                  <Badge tone="blue">{items.length} shown</Badge>
                </div>
              }
            />
            <CardBody>
              <div className="space-y-2">
                {items.map((d) => {
                  const isArchived = !!d.archived_at;
                  const isEditing = editDeliverableId === d.id;
                  return (
                    <div key={d.id} className="surface-soft px-3 py-3 rounded-2xl">
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {isArchived ? <Badge tone="neutral">archived</Badge> : null}
                              <Badge tone={toneForStatus(d.status) as any}>{d.status}</Badge>
                              {d.sponsor_approval_required ? <Badge tone="yellow">approval</Badge> : null}
                              {d.guaranteed ? <Badge tone="blue">guaranteed</Badge> : null}
                              <span className="text-sm font-semibold truncate">{d.title}</span>
                            </div>
                            <div className="mt-1 text-xs muted">
                              ID {d.id} • {d.type} • due {d.due_date} • owner {d.owner || "—"} • value {d.value ?? "—"}
                            </div>
                            {d.brief ? <div className="mt-2 text-sm text-slate-700 dark:text-white/80">{d.brief}</div> : null}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <select
                              className="surface-soft px-3 py-2 rounded-xl text-sm"
                              value={d.status}
                              onChange={async (e) => {
                                try {
                                  await api.updateDeliverable(d.id, { status: e.target.value });
                                  await refreshCore();
                                } catch (err: any) {
                                  alert(err.message);
                                }
                              }}
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>

                            {!isEditing ? (
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setEditDeliverableId(d.id);
                                  setDTitle(d.title || "");
                                  setDType(d.type || "");
                                  setDDue(d.due_date || "");
                                  setDOwner((d.owner || "") as string);
                                  setDValue(d.value === null || typeof d.value === "undefined" ? "" : String(d.value));
                                  setDBrief((d.brief || "") as string);
                                  setDGuaranteed(!!d.guaranteed);
                                  setDApproval(!!d.sponsor_approval_required);
                                }}
                              >
                                Edit
                              </Button>
                            ) : null}

                            {!isArchived ? (
                              <Button
                                variant="secondary"
                                onClick={async () => {
                                  if (!confirm("Archive this deliverable? (You can restore later)")) return;
                                  await api.archiveDeliverable(d.id);
                                  toast.push({
                                    title: "Deliverable archived",
                                    actionLabel: "Undo",
                                    onAction: async () => {
                                      await api.restoreDeliverable(d.id);
                                      await refreshCore();
                                    },
                                  });
                                  await refreshCore();
                                }}
                              >
                                Archive
                              </Button>
                            ) : (
                              <Button
                                variant="primary"
                                onClick={async () => {
                                  await api.restoreDeliverable(d.id);
                                  toast.push({ title: "Deliverable restored" });
                                  await refreshCore();
                                }}
                              >
                                Restore
                              </Button>
                            )}

                            {d.sponsor_approval_required ? (
                              <Button
                                variant="secondary"
                                onClick={async () => {
                                  try {
                                    await api.updateDeliverable(d.id, {
                                      sponsor_approved_at: new Date().toISOString(),
                                      sponsor_approved_by: "sponsor",
                                    });
                                    await refreshCore();
                                  } catch (err: any) {
                                    alert(err.message);
                                  }
                                }}
                              >
                                Mark approved
                              </Button>
                            ) : null}

                            <Button
                              variant="ghost"
                              onClick={() => {
                                setSelectedId(d.id);
                                setTab("proofs");
                              }}
                            >
                              Proofs
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setSelectedId(d.id);
                                setTab("comments");
                              }}
                            >
                              Comments
                            </Button>
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="surface-soft p-3 rounded-2xl">
                            <div className="grid gap-2 md:grid-cols-6">
                              <div className="md:col-span-2"><Input value={dTitle} onChange={(e) => setDTitle(e.target.value)} placeholder="Title" /></div>
                              <Input value={dType} onChange={(e) => setDType(e.target.value)} placeholder="Type" />
                              <Input value={dDue} onChange={(e) => setDDue(e.target.value)} type="date" />
                              <Input value={dOwner} onChange={(e) => setDOwner(e.target.value)} placeholder="Owner" />
                              <Input value={dValue} onChange={(e) => setDValue(e.target.value)} placeholder="Value" />
                            </div>
                            <div className="mt-2 grid gap-2 md:grid-cols-2">
                              <label className="surface-soft px-3 py-2 rounded-2xl text-sm flex items-center gap-2">
                                <input type="checkbox" checked={dGuaranteed} onChange={(e) => setDGuaranteed(e.target.checked)} /> Guaranteed
                              </label>
                              <label className="surface-soft px-3 py-2 rounded-2xl text-sm flex items-center gap-2">
                                <input type="checkbox" checked={dApproval} onChange={(e) => setDApproval(e.target.checked)} /> Sponsor approval required
                              </label>
                            </div>
                            <div className="mt-2">
                              <Textarea value={dBrief} onChange={(e) => setDBrief(e.target.value)} placeholder="Brief" rows={3} />
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 justify-end">
                              <Button
                                variant="primary"
                                disabled={!deliverableDirty}
                                onClick={async () => {
                                  try {
                                    await api.updateDeliverable(d.id, {
                                      title: dTitle,
                                      type: dType,
                                      due_date: dDue,
                                      owner: dOwner || null,
                                      value: dValue ? Number(dValue) : null,
                                      brief: dBrief || null,
                                      guaranteed: dGuaranteed,
                                      sponsor_approval_required: dApproval,
                                    });
                                    setEditDeliverableId(null);
                                    toast.push({ title: "Deliverable updated" });
                                    await refreshCore();
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
                                  setEditDeliverableId(null);
                                  setDTitle("");
                                  setDType("");
                                  setDDue("");
                                  setDOwner("");
                                  setDValue("");
                                  setDBrief("");
                                  setDGuaranteed(false);
                                  setDApproval(false);
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        {d.sponsor_approval_required ? (
                          <div className="text-xs muted">
                            Sponsor approved: {d.sponsor_approved_at ? fmtDt(d.sponsor_approved_at) : "pending"}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 ? <div className="text-sm muted">No deliverables yet. Apply a template to get started.</div> : null}
              </div>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {/* Proof Vault tab */}
      {tab === "proofs" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader title="Select Deliverable" subtitle="Proofs are stored per deliverable" />
            <CardBody>
              <div className="space-y-2">
                {items.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedId(d.id)}
                    className={
                      "w-full text-left px-3 py-2 rounded-2xl surface-soft " +
                      (selectedId === d.id ? "ring-2 ring-slate-900/20 dark:ring-white/20" : "")
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{d.title}</div>
                        <div className="text-xs muted">ID {d.id} • due {d.due_date}</div>
                      </div>
                      <Badge tone={toneForStatus(d.status) as any}>{d.status}</Badge>
                    </div>
                  </button>
                ))}
                {items.length === 0 ? <div className="text-sm muted">No deliverables yet.</div> : null}
              </div>
            </CardBody>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader
              title={selected ? `Proof Vault — ${selected.title}` : "Proof Vault"}
              subtitle="Add link proofs or upload files (screenshots, PDFs)"
              right={selected ? <Badge tone="neutral">Deliverable #{selected.id}</Badge> : null}
            />
            <CardBody>
              {!selected ? <div className="text-sm muted">Select a deliverable.</div> : null}
              {selected ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Card>
                      <CardHeader title="Add Proof Link" subtitle="URL + note" />
                      <CardBody>
                        <div className="space-y-2">
                          <Input value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} placeholder="https://..." />
                          <Textarea value={proofNote} onChange={(e) => setProofNote(e.target.value)} placeholder="Note" rows={3} />
                          <Button
                            variant="secondary"
                            onClick={async () => {
                              try {
                                await api.addProof(selected.id, {
                                  kind: "link",
                                  url: proofUrl,
                                  note: proofNote,
                                  deliverable_id: selected.id,
                                });
                                await refreshProofs(selected.id);
                                alert("Proof link added.");
                              } catch (e: any) {
                                alert(e.message);
                              }
                            }}
                          >
                            Add link
                          </Button>
                        </div>
                      </CardBody>
                    </Card>

                    <Card>
                      <CardHeader title="Upload Proof File" subtitle="PNG/JPG/PDF/MP4 (local dev stores in /uploads)" />
                      <CardBody>
                        <div className="space-y-2">
                          <input
                            type="file"
                            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                            className="block w-full text-sm"
                          />
                          <Input value={uploadNote} onChange={(e) => setUploadNote(e.target.value)} placeholder="Optional note" />
                          <Button
                            variant="primary"
                            disabled={!uploadFile}
                            onClick={async () => {
                              if (!uploadFile) return;
                              try {
                                await api.uploadProofFile(selected.id, uploadFile, uploadNote);
                                setUploadFile(null);
                                setUploadNote("");
                                await refreshProofs(selected.id);
                                alert("File uploaded.");
                              } catch (e: any) {
                                alert(e.message);
                              }
                            }}
                          >
                            Upload
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">Existing Proofs</div>
                      <Button variant="ghost" onClick={() => refreshProofs(selected.id).catch((e) => alert(e.message))}>Refresh</Button>
                    </div>
                    <div className="mt-2 space-y-2">
                      {proofs.map((p) => (
                        <div key={p.id} className="surface-soft px-3 py-2 rounded-2xl">
                          <div className="flex items-center justify-between gap-2">
                            <Badge tone={p.kind === "file" ? "blue" : "neutral"}>{p.kind}</Badge>
                            <div className="text-xs muted">{fmtDt(p.created_at)}</div>
                          </div>
                          {p.kind === "link" ? (
                            <div className="mt-2">
                              <a className="link-accent text-sm" href={p.url || "#"} target="_blank" rel="noreferrer">
                                {p.url}
                              </a>
                            </div>
                          ) : (
                            <div className="mt-2">
                              <a
                                className="link-accent text-sm"
                                href={"#"}
                                onClick={async (e) => {
                                  e.preventDefault();
                                  try {
                                    const buf = await api.downloadProofFile(p.id);
                                    const blob = new Blob([buf], { type: p.mime_type || "application/octet-stream" });
                                    const url = URL.createObjectURL(blob);
                                    window.open(url, "_blank");
                                  } catch (err: any) {
                                    alert(err?.message || "Failed to download file");
                                  }
                                }}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {p.file_name || "download"}
                              </a>
                              <div className="text-xs muted">{p.mime_type || ""}</div>
                            </div>
                          )}
                          {p.note ? <div className="mt-2 text-sm text-slate-700 dark:text-white/80">{p.note}</div> : null}
                        </div>
                      ))}
                      {proofs.length === 0 ? <div className="text-sm muted">No proofs yet for this deliverable.</div> : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>
      ) : null}

      {/* BrandKit tab */}
      {tab === "brandkit" ? (
        <Card>
          <CardHeader
            title="BrandKit"
            subtitle="Guidelines, hashtags, required tags, do/don't and assets — sponsor-safe"
            right={brandkit?.updated_at ? <Badge tone="neutral">updated {fmtDt(brandkit.updated_at)}</Badge> : null}
          />
          <CardBody>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-semibold mb-1">Guidelines (Markdown)</div>
                  <Textarea value={bkGuidelines} onChange={(e) => setBkGuidelines(e.target.value)} rows={10} placeholder="Write sponsor guidelines..." />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold mb-1">Hashtags</div>
                    <Input value={bkHashtags} onChange={(e) => setBkHashtags(e.target.value)} placeholder="#ad, #partner" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-1">Required tags</div>
                    <Input value={bkReqTags} onChange={(e) => setBkReqTags(e.target.value)} placeholder="@brand, @team" />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-sm font-semibold mb-1">Do</div>
                    <Textarea value={bkDo} onChange={(e) => setBkDo(e.target.value)} rows={6} placeholder="One per line" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-1">Don't</div>
                    <Textarea value={bkDont} onChange={(e) => setBkDont(e.target.value)} rows={6} placeholder="One per line" />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Assets</div>
                  <Button
                    variant="ghost"
                    onClick={() => setBkAssets((a) => [...a, { name: "", url: "" }])}
                  >
                    + Add asset
                  </Button>
                </div>
                <div className="space-y-2">
                  {bkAssets.map((a, idx) => (
                    <div key={idx} className="surface-soft p-3 rounded-2xl">
                      <div className="grid gap-2 md:grid-cols-2">
                        <Input
                          value={a.name}
                          onChange={(e) => {
                            const v = e.target.value;
                            setBkAssets((old) => old.map((x, i) => (i === idx ? { ...x, name: v } : x)));
                          }}
                          placeholder="Name (Logo, Guidelines PDF...)"
                        />
                        <Input
                          value={a.url}
                          onChange={(e) => {
                            const v = e.target.value;
                            setBkAssets((old) => old.map((x, i) => (i === idx ? { ...x, url: v } : x)));
                          }}
                          placeholder="URL"
                        />
                      </div>
                      <div className="mt-2 flex justify-end">
                        <Button
                          variant="ghost"
                          onClick={() => setBkAssets((old) => old.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    onClick={async () => {
                      try {
                        await api.updateBrandKit(did, {
                          guidelines_md: bkGuidelines,
                          hashtags: parseCSV(bkHashtags),
                          required_tags: parseCSV(bkReqTags),
                          do: parseLines(bkDo),
                          dont: parseLines(bkDont),
                          assets: bkAssets.filter((x) => x.name || x.url),
                        });
                        await refreshBrandkit();
                        alert("BrandKit saved.");
                      } catch (e: any) {
                        alert(e.message);
                      }
                    }}
                  >
                    Save BrandKit
                  </Button>
                  <Button variant="secondary" onClick={() => refreshBrandkit().catch((e) => alert(e.message))}>Reload</Button>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* Comments tab */}
      {tab === "comments" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader title="Select Deliverable" subtitle="Comments stay attached to deliverables" />
            <CardBody>
              <div className="space-y-2">
                {items.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedId(d.id)}
                    className={
                      "w-full text-left px-3 py-2 rounded-2xl surface-soft " +
                      (selectedId === d.id ? "ring-2 ring-slate-900/20 dark:ring-white/20" : "")
                    }
                  >
                    <div className="text-sm font-medium truncate">{d.title}</div>
                    <div className="text-xs muted">ID {d.id} • {d.status}</div>
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title={selected ? `Comments — ${selected.title}` : "Comments"} subtitle="Internal notes & sponsor review trail" />
            <CardBody>
              {!selected ? <div className="text-sm muted">Select a deliverable.</div> : null}
              {selected ? (
                <div className="space-y-3">
                  <Textarea value={commentBody} onChange={(e) => setCommentBody(e.target.value)} rows={3} placeholder="Write a comment..." />
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      disabled={!commentBody.trim()}
                      onClick={async () => {
                        try {
                          await api.addComment(selected.id, commentBody.trim());
                          setCommentBody("");
                          await refreshComments(selected.id);
                        } catch (e: any) {
                          alert(e.message);
                        }
                      }}
                    >
                      Post
                    </Button>
                    <Button variant="secondary" onClick={() => refreshComments(selected.id).catch((e) => alert(e.message))}>Refresh</Button>
                  </div>
                  <div className="space-y-2">
                    {comments.map((c) => (
                      <div key={c.id} className="surface-soft p-3 rounded-2xl">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold">{c.author}</div>
                          <div className="text-xs muted">{fmtDt(c.created_at)}</div>
                        </div>
                        <div className="mt-2 text-sm text-slate-700 dark:text-white/80 whitespace-pre-wrap">{c.body}</div>
                      </div>
                    ))}
                    {comments.length === 0 ? <div className="text-sm muted">No comments yet.</div> : null}
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>
      ) : null}

      {/* Activity tab */}
      {tab === "activity" ? (
        <Card>
          <CardHeader title="Activity Feed" subtitle="Audit log for the deal" right={<Button variant="ghost" onClick={() => refreshActivity().catch((e) => alert(e.message))}>Refresh</Button>} />
          <CardBody>
            <div className="space-y-2">
              {activity.map((a) => (
                <div key={a.id} className="surface-soft p-3 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{a.summary}</div>
                    <div className="text-xs muted">{fmtDt(a.created_at)}</div>
                  </div>
                  <div className="mt-1 text-xs muted">{a.entity_type} • {a.action} • {a.actor || "—"}</div>
                </div>
              ))}
              {activity.length === 0 ? <div className="text-sm muted">No activity yet.</div> : null}
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}