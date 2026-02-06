import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { Card, CardBody, CardHeader } from "../components/Card";
import { Textarea, Input } from "../components/Input";
import { Button } from "../components/Button";
import { Badge } from "../components/Badge";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { useToast } from "../components/Toast";
import { useUnsavedChangesGuard } from "../lib/useUnsavedChangesGuard";

type Ticket = {
  id: number;
  subject: string;
  body: string;
  status: "open" | "pending" | "closed" | string;
  priority: "low" | "normal" | "high" | string;
  created_at: string;
  archived_at?: string | null;
};

export function TicketDetailPage() {
  const { ticketId } = useParams();
  const id = Number(ticketId);
  const toast = useToast();

  const [data, setData] = useState<any>(null);
  const ticket: Ticket | null = data?.ticket ?? null;

  const [reply, setReply] = useState("");

  const [editMode, setEditMode] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<string>("normal");

  async function refresh() {
    const d = await api.getTicket(id);
    setData(d);
    setReply("");
    // only sync form if not editing
    if (!editMode) {
      setSubject(d?.ticket?.subject || "");
      setBody(d?.ticket?.body || "");
      setPriority(d?.ticket?.priority || "normal");
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!ticket) return;
    if (!editMode) {
      setSubject(ticket.subject || "");
      setBody(ticket.body || "");
      setPriority(ticket.priority || "normal");
    }
  }, [ticket?.id, editMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = useMemo(() => {
    if (!ticket) return false;
    return subject !== (ticket.subject || "") || body !== (ticket.body || "") || priority !== (ticket.priority || "normal");
  }, [ticket, subject, body, priority]);

  useUnsavedChangesGuard(editMode && isDirty);

  async function setStatus(status: string) {
    await api.updateTicket(id, { status });
    await refresh();
  }

  async function archive() {
    if (!window.confirm("Archive this ticket? You can restore it later.")) return;
    await api.archiveTicket(id);
    toast.push({
      title: "Ticket archived",
      message: `Ticket #${id} was archived.`,
      actionLabel: "Undo",
      onAction: async () => { await api.restoreTicket(id); await refresh(); },
    });
    await refresh();
  }

  async function restore() {
    await api.restoreTicket(id);
    toast.push({ title: "Ticket restored", message: `Ticket #${id} is active again.` });
    await refresh();
  }

  async function saveEdits() {
    await api.updateTicket(id, { subject, body, priority });
    setEditMode(false);
    toast.push({ title: "Saved", message: "Ticket updated." });
    await refresh();
  }

  function cancelEdits() {
    if (isDirty && !window.confirm("Discard changes?")) return;
    setEditMode(false);
    if (ticket) {
      setSubject(ticket.subject || "");
      setBody(ticket.body || "");
      setPriority(ticket.priority || "normal");
    }
  }

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[
          { label: "Dashboard", to: "/" },
          { label: "Tickets", to: "/tickets" },
          { label: `#${id}` },
        ]}
        backTo="/tickets"
        backLabel="Tickets"
      />

      <Card>
        <CardHeader
          title={`Ticket #${id}`}
          subtitle={ticket?.subject || ""}
          right={
            ticket ? (
              <div className="flex items-center gap-2">
                <Badge tone={ticket.status === "closed" ? "neutral" : ticket.status === "pending" ? "yellow" : "blue"}>
                  {ticket.status}
                </Badge>
                {ticket.archived_at ? <Badge tone="neutral">archived</Badge> : null}
              </div>
            ) : null
          }
        />
        <CardBody>
          {!ticket ? (
            <div className="text-sm muted">Loading…</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant={ticket.status === "open" ? "primary" : "secondary"} onClick={() => setStatus("open")}>
                    Open
                  </Button>
                  <Button size="sm" variant={ticket.status === "pending" ? "primary" : "secondary"} onClick={() => setStatus("pending")}>
                    Pending
                  </Button>
                  <Button size="sm" variant={ticket.status === "closed" ? "primary" : "secondary"} onClick={() => setStatus("closed")}>
                    Closed
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!ticket.archived_at ? (
                    <Button size="sm" variant="danger" onClick={archive}>Archive</Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={restore}>Restore</Button>
                  )}
                  {!editMode ? (
                    <Button size="sm" variant="secondary" onClick={() => setEditMode(true)}>Edit</Button>
                  ) : (
                    <>
                      <Button size="sm" variant="primary" onClick={saveEdits} disabled={!isDirty}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={cancelEdits}>Cancel</Button>
                    </>
                  )}
                </div>
              </div>

              {editMode ? (
                <div className="grid gap-2">
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
                  <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Body" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs muted">Priority</span>
                    <select
                      className="surface-soft rounded-xl px-3 py-2 text-sm"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    >
                      <option value="low">low</option>
                      <option value="normal">normal</option>
                      <option value="high">high</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="surface-soft p-3">
                  <div className="text-xs muted mb-1">Body</div>
                  <div className="text-sm whitespace-pre-wrap">{ticket.body}</div>
                </div>
              )}

              <div>
                <div className="text-sm font-medium mb-2">Messages</div>
                <div className="space-y-2">
                  {data?.messages?.map((m: any) => (
                    <div key={m.id} className="surface-soft p-3">
                      <div className="text-xs muted">{m.sender} • {m.created_at}</div>
                      <div className="mt-1 text-sm whitespace-pre-wrap">{m.message}</div>
                    </div>
                  ))}
                  {(!data?.messages || data.messages.length === 0) ? <div className="text-sm muted">No messages yet.</div> : null}
                </div>

                <div className="mt-4 space-y-2">
                  <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply…" />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      onClick={async () => {
                        if (!reply.trim()) return;
                        await api.replyTicket(id, reply);
                        toast.push({ title: "Reply sent" });
                        await refresh();
                      }}
                      disabled={!reply.trim()}
                    >
                      Reply
                    </Button>
                    <Button variant="ghost" onClick={() => setReply("")}>Clear</Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}