import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { Shell } from "../components/Shell";
import { Card, CardBody, CardHeader } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Badge } from "../components/Badge";

type Deal = any;
type Sponsor = any;
type Deliverable = any;
type Proof = any;
type Ticket = any;
type TicketMessage = any;
type Claim = any;
type Comment = any;
type BrandKit = any;

function fmtDate(d?: string) {
  if (!d) return "";
  try { return new Date(d).toLocaleString(); } catch { return d; }
}

function statusBadge(status?: string) {
  const s = (status || "").toLowerCase();
  if (s.includes("approved")) return <Badge tone="green">Approved</Badge>;
  if (s.includes("needs")) return <Badge tone="yellow">Needs changes</Badge>;
  if (s.includes("review")) return <Badge tone="blue">Review</Badge>;
  if (s.includes("submitted") || s.includes("proof")) return <Badge tone="blue">{status}</Badge>;
  if (s.includes("open")) return <Badge tone="yellow">Open</Badge>;
  if (s.includes("closed")) return <Badge tone="green">Closed</Badge>;
  return <Badge tone="neutral">{status || "—"}</Badge>;
}

export function PortalPage() {
  const params = useParams();
  const initialSponsorToken = (params as any).token && (window.location.pathname.includes("/portal/sponsor/")) ? (params as any).token : "";
  const initialDealToken = (params as any).token && (window.location.pathname.includes("/portal/deal/")) ? (params as any).token : "";

  const [sponsorToken, setSponsorToken] = useState<string>(initialSponsorToken);
  const [dealToken, setDealToken] = useState<string>(initialDealToken);

  const [sponsor, setSponsor] = useState<Sponsor | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [brandkit, setBrandkit] = useState<BrandKit | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [err, setErr] = useState<string>("");

  const [activeTab, setActiveTab] = useState<"overview" | "deliverables" | "tickets" | "claims">("overview");
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<number | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  const selectedDeliverable = useMemo(
    () => deliverables.find((d: any) => d.id === selectedDeliverableId) || null,
    [deliverables, selectedDeliverableId]
  );
  const deliverableProofs = useMemo(() => {
    if (!selectedDeliverableId) return [];
    return proofs.filter((p: any) => p.deliverable_id === selectedDeliverableId);
  }, [proofs, selectedDeliverableId]);
  const deliverableComments = useMemo(() => {
    if (!selectedDeliverableId) return [];
    return comments.filter((c: any) => c.deliverable_id === selectedDeliverableId);
  }, [comments, selectedDeliverableId]);

  const selectedTicket = useMemo(
    () => tickets.find((t: any) => t.id === selectedTicketId) || null,
    [tickets, selectedTicketId]
  );
  const messagesForTicket = useMemo(() => {
    if (!selectedTicketId) return [];
    return ticketMessages.filter((m: any) => m.ticket_id === selectedTicketId);
  }, [ticketMessages, selectedTicketId]);

  async function loadSponsor(tok: string) {
    setErr("");
    const data = await api.sponsorPortal(tok);
    setSponsor(data.sponsor);
    setDeals(data.deals || []);
    setDeal(null);
    setDeliverables([]);
    setProofs([]);
    setComments([]);
    setBrandkit(null);
    setTickets([]);
    setTicketMessages([]);
    setClaims([]);
    setActiveTab("overview");
  }

  async function loadDeal(tok: string) {
    setErr("");
    const data = await api.dealPortal(tok);
    setDeal(data.deal);
    setDeliverables(data.deliverables || []);
    setProofs(data.proofs || []);
    setComments(data.comments || []);
    setBrandkit(data.brandkit || null);
    setTickets(data.tickets || []);
    setTicketMessages(data.ticket_messages || []);
    setClaims(data.claims || []);
    setActiveTab("overview");
  }

  // Auto-load when opened via direct link
  useEffect(() => {
    (async () => {
      try {
        if (initialSponsorToken) await loadSponsor(initialSponsorToken);
        if (initialDealToken) await loadDeal(initialDealToken);
      } catch (e: any) {
        setErr(e.message || "Failed to load portal");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketBody, setTicketBody] = useState("");

  const [replyText, setReplyText] = useState("");

  const [claimDeliverableId, setClaimDeliverableId] = useState<number | null>(null);
  const [claimReason, setClaimReason] = useState("");
  const [claimDesc, setClaimDesc] = useState("");

  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentBody, setCommentBody] = useState("");

  const [proofUrl, setProofUrl] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNote, setUploadNote] = useState("");

  async function createTicket() {
    if (!sponsorToken) return setErr("Please enter sponsor token");
    if (!ticketSubject.trim() || !ticketBody.trim()) return setErr("Subject and message are required");
    setErr("");
    const t = await api.createTicketPortal({
      sponsor_token: sponsorToken,
      deal_token: dealToken || null,
      subject: ticketSubject,
      body: ticketBody,
    });
    setTicketSubject("");
    setTicketBody("");
    // Refresh deal view to get messages list updated
    if (dealToken) await loadDeal(dealToken);
    else await loadSponsor(sponsorToken);
    setSelectedTicketId(t.id);
    setActiveTab("tickets");
  }

  async function sendReply() {
    if (!selectedTicketId) return;
    if (!sponsorToken) return setErr("Please enter sponsor token");
    if (!replyText.trim()) return setErr("Message required");
    setErr("");
    await api.replyTicketPortal(selectedTicketId, {
      sponsor_token: sponsorToken,
      deal_token: dealToken || null,
      message: replyText,
    });
    setReplyText("");
    if (dealToken) await loadDeal(dealToken);
    else await loadSponsor(sponsorToken);
  }

  async function createClaim() {
    if (!dealToken) return setErr("Claim requires a deal token");
    if (!claimDeliverableId) return setErr("Select a deliverable");
    if (!claimReason.trim()) return setErr("Reason required");
    setErr("");
    await api.createClaimPortal({
      deal_token: dealToken,
      deliverable_id: claimDeliverableId,
      reason: claimReason,
      description: claimDesc,
    });
    setClaimReason("");
    setClaimDesc("");
    setClaimDeliverableId(null);
    await loadDeal(dealToken);
    setActiveTab("claims");
  }

  async function approveDeliverable() {
    if (!dealToken || !selectedDeliverableId) return;
    setErr("");
    await api.approveDeliverablePortal(selectedDeliverableId, {
      deal_token: dealToken,
      approved_by: commentAuthor || null,
    });
    await loadDeal(dealToken);
  }

  async function addComment() {
    if (!dealToken || !selectedDeliverableId) return;
    if (!commentBody.trim()) return setErr("Comment required");
    setErr("");
    await api.addDeliverableCommentPortal(selectedDeliverableId, {
      deal_token: dealToken,
      author: commentAuthor || null,
      body: commentBody,
    });
    setCommentBody("");
    await loadDeal(dealToken);
  }

  async function addProofLink() {
    if (!dealToken || !selectedDeliverableId) return;
    if (!proofUrl.trim()) return setErr("URL required");
    setErr("");
    await api.addProofLinkPortal(selectedDeliverableId, { deal_token: dealToken, url: proofUrl, note: proofNote || null });
    setProofUrl(""); setProofNote("");
    await loadDeal(dealToken);
  }

  async function uploadProof() {
    if (!dealToken || !selectedDeliverableId) return;
    if (!uploadFile) return setErr("Choose a file");
    setErr("");
    await api.uploadProofFilePortal(selectedDeliverableId, uploadFile, uploadNote || "", dealToken);
    setUploadFile(null); setUploadNote("");
    await loadDeal(dealToken);
  }

  const guaranteedDeliverables = useMemo(
    () => deliverables.filter((d: any) => !!d.guaranteed),
    [deliverables]
  );

  return (
    <Shell>
      <div className="space-y-4">
        <Card>
          <CardHeader title="Sponsor Portal" />
          <CardBody>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <div className="text-sm opacity-70 mb-1">Sponsor token</div>
              <div className="flex gap-2">
                <Input value={sponsorToken} onChange={(e) => setSponsorToken(e.target.value)} placeholder="sponsor token" />
                <Button onClick={async () => { try { await loadSponsor(sponsorToken); } catch (e: any) { setErr(e.message); } }}>Load</Button>
              </div>
              <div className="text-xs opacity-70 mt-1">
                Use sponsor token to see sponsor + deals, create general support tickets.
              </div>
            </div>
            <div>
              <div className="text-sm opacity-70 mb-1">Deal token</div>
              <div className="flex gap-2">
                <Input value={dealToken} onChange={(e) => setDealToken(e.target.value)} placeholder="deal token" />
                <Button onClick={async () => { try { await loadDeal(dealToken); } catch (e: any) { setErr(e.message); } }}>Load</Button>
              </div>
              <div className="text-xs opacity-70 mt-1">
                Use deal token for deliverables, proofs, comments, claims, and deal-specific tickets.
              </div>
            </div>
          </div>
          {err ? <div className="mt-3 text-red-600 text-sm">{err}</div> : null}
          </CardBody>
        </Card>

        {sponsor ? (
          <Card>
          <CardHeader title="Sponsor" />
          <CardBody>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold">{sponsor.name}</div>
                <div className="text-sm opacity-70">{sponsor.contact_email || "—"}</div>
              </div>
              <div className="text-sm opacity-70">
                Deals: <span className="font-semibold">{deals.length}</span>
              </div>
            </div>
            {deals.length ? (
              <div className="mt-3 space-y-2">
                {deals.map((d: any) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 p-2 rounded border">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{d.title || `Deal #${d.id}`}</div>
                      <div className="text-xs opacity-70 truncate">Deal token: {d.portal_token}</div>
                    </div>
                    <Button onClick={async () => { setDealToken(d.portal_token); await loadDeal(d.portal_token); }}>Open</Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm opacity-70">No deals found for this sponsor.</div>
            )}
          </CardBody>
          </Card>
        ) : null}

        {deal ? (
          <>
            <Card>
          <CardHeader title="Deal Overview" />
          <CardBody>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-semibold">{deal.title || `Deal #${deal.id}`}</div>
                  <div className="text-sm opacity-70">
                    Created: {fmtDate(deal.created_at)} • Status: {statusBadge(deal.status)}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant={activeTab === "overview" ? "primary" : "secondary"} onClick={() => setActiveTab("overview")}>Overview</Button>
                  <Button variant={activeTab === "deliverables" ? "primary" : "secondary"} onClick={() => setActiveTab("deliverables")}>Deliverables</Button>
                  <Button variant={activeTab === "tickets" ? "primary" : "secondary"} onClick={() => setActiveTab("tickets")}>Tickets</Button>
                  <Button variant={activeTab === "claims" ? "primary" : "secondary"} onClick={() => setActiveTab("claims")}>Claims</Button>
                </div>
              </div>

              {activeTab === "overview" ? (
                <div className="mt-4 grid md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="text-sm opacity-70">What you can do here:</div>
                    <ul className="text-sm list-disc pl-5 space-y-1">
                      <li>Review deliverables, proofs, and comments</li>
                      <li>Approve deliverables (if applicable)</li>
                      <li>Create and reply to support tickets</li>
                      <li>Create claims for guaranteed deliverables</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm opacity-70">Brand Kit</div>
                    {brandkit ? (
                      <div className="text-sm">
                        <div><span className="opacity-70">Brand:</span> {brandkit.brand_name || "—"}</div>
                        <div className="mt-1 opacity-70 text-xs whitespace-pre-wrap">{brandkit.guidelines || brandkit.notes || "No guidelines provided."}</div>
                      </div>
                    ) : (
                      <div className="text-sm opacity-70">No brand kit set yet.</div>
                    )}
                  </div>
                </div>
              ) : null}

              {activeTab === "deliverables" ? (
                <div className="mt-4 grid md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-sm opacity-70 mb-2">Deliverables</div>
                    <div className="space-y-2">
                      {deliverables.map((d: any) => (
                        <div key={d.id} className={`p-2 rounded border ${selectedDeliverableId === d.id ? "bg-black/5" : ""}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{d.title || `Deliverable #${d.id}`}</div>
                              <div className="text-xs opacity-70 truncate">
                                {statusBadge(d.status)} • Due: {d.due_at ? fmtDate(d.due_at) : "—"} • {d.guaranteed ? "Guaranteed" : "Non-guaranteed"}
                              </div>
                            </div>
                            <Button onClick={() => { setSelectedDeliverableId(d.id); }}>Open</Button>
                          </div>
                        </div>
                      ))}
                      {!deliverables.length ? <div className="text-sm opacity-70">No deliverables.</div> : null}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm opacity-70 mb-2">Details</div>
                    {selectedDeliverable ? (
                      <div className="space-y-3">
                        <div className="p-3 rounded border">
                          <div className="font-semibold">{selectedDeliverable.title || `Deliverable #${selectedDeliverable.id}`}</div>
                          <div className="text-sm opacity-70 mt-1">Status: {statusBadge(selectedDeliverable.status)}</div>
                          <div className="text-sm opacity-70">Notes: {selectedDeliverable.notes || "—"}</div>
                          <div className="mt-2">
                            <Button onClick={approveDeliverable}>Approve</Button>
                          </div>
                        </div>

                        <div className="p-3 rounded border space-y-2">
                          <div className="font-semibold">Proofs</div>
                          {deliverableProofs.length ? (
                            <div className="space-y-1">
                              {deliverableProofs.map((p: any) => (
                                <div key={p.id} className="text-sm">
                                  {p.kind === "link" ? (
                                    <a className="underline" href={p.url} target="_blank" rel="noreferrer">{p.url}</a>
                                  ) : (
                                    <span>{p.file_name || "file"}</span>
                                  )}
                                  <span className="opacity-70"> {p.note ? `— ${p.note}` : ""}</span>
                                </div>
                              ))}
                            </div>
                          ) : <div className="text-sm opacity-70">No proofs yet.</div>}

                          <div className="grid gap-2">
                            <div className="text-sm opacity-70">Add proof link</div>
                            <Input value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} placeholder="https://..." />
                            <Input value={proofNote} onChange={(e) => setProofNote(e.target.value)} placeholder="Note (optional)" />
                            <Button onClick={addProofLink}>Add link</Button>
                          </div>

                          <div className="grid gap-2 mt-2">
                            <div className="text-sm opacity-70">Upload proof file (png/jpg/pdf/mp4)</div>
                            <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
                            <Input value={uploadNote} onChange={(e) => setUploadNote(e.target.value)} placeholder="Note (optional)" />
                            <Button onClick={uploadProof}>Upload file</Button>
                          </div>
                        </div>

                        <div className="p-3 rounded border space-y-2">
                          <div className="font-semibold">Comments</div>
                          {deliverableComments.length ? (
                            <div className="space-y-2">
                              {deliverableComments.map((c: any) => (
                                <div key={c.id} className="text-sm">
                                  <div className="opacity-70 text-xs">{c.author || "—"} • {fmtDate(c.created_at)}</div>
                                  <div className="whitespace-pre-wrap">{c.body}</div>
                                </div>
                              ))}
                            </div>
                          ) : <div className="text-sm opacity-70">No comments yet.</div>}

                          <div className="grid gap-2">
                            <Input value={commentAuthor} onChange={(e) => setCommentAuthor(e.target.value)} placeholder="Your name (optional)" />
                            <Input value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="Write a comment..." />
                            <Button onClick={addComment}>Post comment</Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm opacity-70">Select a deliverable to view proofs, comments, and approve.</div>
                    )}
                  </div>
                </div>
              ) : null}

              {activeTab === "tickets" ? (
                <div className="mt-4 grid md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-sm opacity-70 mb-2">Create ticket</div>
                    <div className="space-y-2">
                      <Input value={ticketSubject} onChange={(e) => setTicketSubject(e.target.value)} placeholder="Subject" />
                      <Input value={ticketBody} onChange={(e) => setTicketBody(e.target.value)} placeholder="Describe your issue..." />
                      <Button onClick={createTicket}>Create</Button>
                    </div>

                    <div className="mt-4 text-sm opacity-70 mb-2">Tickets</div>
                    <div className="space-y-2">
                      {tickets.map((t: any) => (
                        <div key={t.id} className={`p-2 rounded border ${selectedTicketId === t.id ? "bg-black/5" : ""}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{t.subject || `Ticket #${t.id}`}</div>
                              <div className="text-xs opacity-70 truncate">
                                {statusBadge(t.status)} • Updated: {fmtDate(t.last_reply_at || t.created_at)}
                              </div>
                            </div>
                            <Button onClick={() => setSelectedTicketId(t.id)}>Open</Button>
                          </div>
                        </div>
                      ))}
                      {!tickets.length ? <div className="text-sm opacity-70">No tickets yet.</div> : null}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm opacity-70 mb-2">Conversation</div>
                    {selectedTicket ? (
                      <div className="space-y-3">
                        <div className="p-3 rounded border">
                          <div className="font-semibold">{selectedTicket.subject || `Ticket #${selectedTicket.id}`}</div>
                          <div className="text-xs opacity-70">Status: {selectedTicket.status} • Created: {fmtDate(selectedTicket.created_at)}</div>
                        </div>

                        <div className="p-3 rounded border space-y-2">
                          {messagesForTicket.length ? (
                            <div className="space-y-2">
                              {messagesForTicket.map((m: any) => (
                                <div key={m.id} className="text-sm">
                                  <div className="opacity-70 text-xs">{m.sender} • {fmtDate(m.created_at)}</div>
                                  <div className="whitespace-pre-wrap">{m.message}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm opacity-70">No messages.</div>
                          )}
                        </div>

                        <div className="p-3 rounded border space-y-2">
                          <Input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Reply..." />
                          <Button onClick={sendReply}>Send</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm opacity-70">Open a ticket to see messages and reply.</div>
                    )}
                  </div>
                </div>
              ) : null}

              {activeTab === "claims" ? (
                <div className="mt-4 grid md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-sm opacity-70 mb-2">Create claim (guaranteed deliverables only)</div>
                    <div className="space-y-2">
                      <div className="text-sm opacity-70">Select deliverable</div>
                      <select className="border rounded p-2 w-full" value={claimDeliverableId || ""} onChange={(e) => setClaimDeliverableId(e.target.value ? Number(e.target.value) : null)}>
                        <option value="">—</option>
                        {guaranteedDeliverables.map((d: any) => (
                          <option key={d.id} value={d.id}>{d.title || `Deliverable #${d.id}`}</option>
                        ))}
                      </select>
                      <Input value={claimReason} onChange={(e) => setClaimReason(e.target.value)} placeholder="Reason" />
                      <Input value={claimDesc} onChange={(e) => setClaimDesc(e.target.value)} placeholder="Details (optional)" />
                      <Button onClick={createClaim}>Submit claim</Button>
                    </div>
                    {!guaranteedDeliverables.length ? (
                      <div className="mt-2 text-sm opacity-70">No guaranteed deliverables on this deal.</div>
                    ) : null}
                  </div>

                  <div>
                    <div className="text-sm opacity-70 mb-2">Claims</div>
                    <div className="space-y-2">
                      {claims.map((c: any) => (
                        <div key={c.id} className="p-2 rounded border">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{c.reason}</div>
                              <div className="text-xs opacity-70 truncate">
                                Deliverable #{c.deliverable_id} • {c.status || "pending"} • {fmtDate(c.created_at)}
                              </div>
                              {c.description ? <div className="text-sm mt-1 whitespace-pre-wrap">{c.description}</div> : null}
                            </div>
                          </div>
                        </div>
                      ))}
                      {!claims.length ? <div className="text-sm opacity-70">No claims yet.</div> : null}
                    </div>
                  </div>
                </div>
              ) : null}
          </CardBody>
            </Card>
          </>
        ) : null}
      </div>
    </Shell>
  );
}

export default PortalPage;