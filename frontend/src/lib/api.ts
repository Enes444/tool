const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(t: string) {
  localStorage.setItem("token", t);
}

export function clearToken() {
  localStorage.removeItem("token");
}

async function request(path: string, opts: RequestInit = {}) {
  const headers = new Headers(opts.headers || {});
  // Default to JSON requests, but allow FormData uploads.
  if (!headers.has("Content-Type") && !(opts.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_URL}${path}`, { ...opts, headers });
  if (!res.ok) {
    if (res.status === 401 && token) {
      try { clearToken(); } catch {}
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/portal")) {
        window.location.href = "/login";
      }
    }
    let msg = `Request failed (${res.status})`;
    try { const j = await res.json(); msg = j.detail || msg; } catch {}
    throw new Error(msg);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/pdf")) return res.arrayBuffer();
  return res.json();
}

export const api = {
  // low-level helpers (keep a single request() implementation)
  get: (path: string) => request(path),
  post: (path: string, body?: any) => request(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: (path: string, body?: any) => request(path, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  put: (path: string, body?: any) => request(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  del: (path: string) => request(path, { method: "DELETE" }),
  postForm: (path: string, fd: FormData) => request(path, { method: "POST", body: fd }),
  login: (email: string, password: string) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  listOrgs: () => request("/api/orgs/"),
  getOrg: (orgId: number) => request(`/api/orgs/`).then((xs: any[]) => (Array.isArray(xs) ? xs.find((o) => o.id === orgId) : null)),
  createOrg: (name: string) => request("/api/orgs/", { method: "POST", body: JSON.stringify({ name }) }),
  updateOrg: (orgId: number, payload: any) => request(`/api/orgs/${orgId}`, { method: "PATCH", body: JSON.stringify(payload) }),

  // Sponsors are scoped to the user's current org (from the JWT). orgId is kept only for backwards compatibility in UI.
  listSponsors: (_orgId?: number, include_archived: boolean = false) => request(`/api/sponsors?include_archived=${include_archived ? 1 : 0}`),
  createSponsor: (organization_id: number, name: string, contact_email?: string) =>
    request("/api/sponsors", { method: "POST", body: JSON.stringify({ organization_id, name, contact_email }) }),
  updateSponsor: (sponsorId: number, payload: any) => request(`/api/sponsors/${sponsorId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  archiveSponsor: (sponsorId: number) => request(`/api/sponsors/${sponsorId}/archive`, { method: "POST", body: JSON.stringify({}) }),
  restoreSponsor: (sponsorId: number) => request(`/api/sponsors/${sponsorId}/restore`, { method: "POST", body: JSON.stringify({}) }),

  listDeals: (sponsorId: number, include_archived: boolean = false) => request(`/api/sponsors/${sponsorId}/deals?include_archived=${include_archived ? 1 : 0}`),
  getSponsor: (sponsorId: number) => request(`/api/sponsors/${sponsorId}`),
  createDeal: (payload: any) => request("/api/deals", { method: "POST", body: JSON.stringify(payload) }),

  getDeal: (dealId: number) => request(`/api/deals/${dealId}`),
  updateDeal: (dealId: number, payload: any) => request(`/api/deals/${dealId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  listDeliverables: (dealId: number, include_archived: boolean = false) => request(`/api/deals/${dealId}/deliverables?include_archived=${include_archived ? 1 : 0}`),
  createDeliverable: (dealId: number, payload: any) => request(`/api/deals/${dealId}/deliverables`, { method: "POST", body: JSON.stringify(payload) }),
  updateDeliverable: (deliverableId: number, payload: any) => request(`/api/deals/deliverables/${deliverableId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  addProof: (deliverableId: number, payload: any) => request(`/api/deals/deliverables/${deliverableId}/proofs`, { method: "POST", body: JSON.stringify(payload) }),
  listProofs: (deliverableId: number) => request(`/api/deals/deliverables/${deliverableId}/proofs`),
  uploadProofFile: (deliverableId: number, file: File, note: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("note", note);
    return request(`/api/deals/deliverables/${deliverableId}/proofs/upload`, { method: "POST", body: fd });
  },

  getBrandKit: (dealId: number) => request(`/api/deals/${dealId}/brandkit`),
  updateBrandKit: (dealId: number, payload: any) => request(`/api/deals/${dealId}/brandkit`, { method: "PUT", body: JSON.stringify(payload) }),

  listComments: (deliverableId: number) => request(`/api/deals/deliverables/${deliverableId}/comments`),
  addComment: (deliverableId: number, body: string) => request(`/api/deals/deliverables/${deliverableId}/comments`, { method: "POST", body: JSON.stringify({ body }) }),

  applyTemplate: (dealId: number, template: string = "valorant_standard") => request(`/api/deals/${dealId}/apply-template`, { method: "POST", body: JSON.stringify({ template }) }),

  listActivity: (orgId: number, dealId?: number) => request(`/api/activity?org_id=${orgId}${dealId ? `&deal_id=${dealId}` : ""}`),
  listNotifications: (orgId: number) => request(`/api/notifications?org_id=${orgId}`),
  syncNotifications: (orgId: number) => request(`/api/notifications/sync?org_id=${orgId}`, { method: "POST", body: JSON.stringify({}) }),
  markNotificationsRead: (orgId: number, ids: number[]) => request(`/api/notifications/mark-read?org_id=${orgId}`, { method: "POST", body: JSON.stringify({ ids }) }),

  listTickets: (orgId: number, include_archived: boolean = false) => request(`/api/tickets?org_id=${orgId}&include_archived=${include_archived ? 1 : 0}`),
  getTicket: (id: number) => request(`/api/tickets/${id}`),
  replyTicket: (id: number, message: string) => request(`/api/tickets/${id}/reply`, { method: "POST", body: JSON.stringify({ message }) }),
  updateTicket: (id: number, payload: any) => request(`/api/tickets/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  archiveTicket: (id: number) => request(`/api/tickets/${id}/archive`, { method: "POST", body: JSON.stringify({}) }),
  restoreTicket: (id: number) => request(`/api/tickets/${id}/restore`, { method: "POST", body: JSON.stringify({}) }),

  listClaims: (orgId: number, include_archived: boolean = false) => request(`/api/claims?org_id=${orgId}&include_archived=${include_archived ? 1 : 0}`),
  updateClaim: (id: number, payload: any) => request(`/api/claims/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  archiveClaim: (id: number) => request(`/api/claims/${id}/archive`, { method: "POST" }),
  restoreClaim: (id: number) => request(`/api/claims/${id}/restore`, { method: "POST" }),
  decideClaim: (id: number, payload: any) => request(`/api/claims/${id}/decide`, { method: "POST", body: JSON.stringify(payload) }),

  sponsorPortal: (token: string) => request(`/api/portal/sponsor/${token}`, { headers: { "Authorization": "" } }),
  dealPortal: (token: string) => request(`/api/portal/deal/${token}`, { headers: { "Authorization": "" } }),
  createTicketPortal: (payload: any) => request(`/api/portal/ticket`, { method: "POST", body: JSON.stringify(payload), headers: { "Authorization": "" } }),
  createClaimPortal: (payload: any) => request(`/api/portal/claim`, { method: "POST", body: JSON.stringify(payload), headers: { "Authorization": "" } }),

  dealPdf: async (dealId: number) => request(`/api/reports/deal/${dealId}.pdf`),
  downloadProofFile: async (proofId: number) => request(`/api/uploads/proof/${proofId}`),


  getTicketPortal: async (ticket_id: number, sponsor_token: string, deal_token?: string | null) => {
    const qs = new URLSearchParams({ sponsor_token });
    if (deal_token) qs.set("deal_token", deal_token);
    return request(`/api/portal/ticket/${ticket_id}?${qs.toString()}`, { headers: { "Authorization": "" } });
  },

  replyTicketPortal: async (ticket_id: number, payload: { sponsor_token: string; deal_token?: string | null; message: string }) =>
    request(`/api/portal/ticket/${ticket_id}/reply`, { method: "POST", body: JSON.stringify(payload), headers: { "Authorization": "" } }),

  approveDeliverablePortal: async (deliverable_id: number, payload: { deal_token: string; approved_by?: string | null }) =>
    request(`/api/portal/deliverables/${deliverable_id}/approve`, { method: "POST", body: JSON.stringify(payload), headers: { "Authorization": "" } }),

  addDeliverableCommentPortal: async (deliverable_id: number, payload: { deal_token: string; author?: string | null; body: string }) =>
    request(`/api/portal/deliverables/${deliverable_id}/comments`, { method: "POST", body: JSON.stringify(payload), headers: { "Authorization": "" } }),

  addProofLinkPortal: async (deliverable_id: number, payload: { deal_token: string; url: string; note?: string | null }) =>
    request(`/api/portal/deliverables/${deliverable_id}/proofs`, { method: "POST", body: JSON.stringify(payload), headers: { "Authorization": "" } }),

  uploadProofFilePortal: async (deliverable_id: number, file: File, note: string, deal_token: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("note", note || "");
    fd.append("deal_token", deal_token);
    return request(`/api/portal/deliverables/${deliverable_id}/proofs/upload`, { method: "POST", body: fd, headers: { "Authorization": "" } });
  },

  // Pilot-safe delete = archive
  archiveDeal: async (deal_id: number) => request(`/api/deals/${deal_id}/archive`, { method: "POST", body: JSON.stringify({}) }),
  unarchiveDeal: async (deal_id: number) => request(`/api/deals/${deal_id}/unarchive`, { method: "POST", body: JSON.stringify({}) }),
  archiveDeliverable: async (deliverable_id: number) => request(`/api/deals/deliverables/${deliverable_id}/archive`, { method: "POST", body: JSON.stringify({}) }),
  restoreDeliverable: async (deliverable_id: number) => request(`/api/deals/deliverables/${deliverable_id}/restore`, { method: "POST", body: JSON.stringify({}) }),
  cancelDeliverable: async (deliverable_id: number) => request(`/api/deliverables/${deliverable_id}/cancel`, { method: "POST", body: JSON.stringify({}) }),
  restoreDeliverableLegacy: async (deliverable_id: number) => request(`/api/deliverables/${deliverable_id}/restore`, { method: "POST", body: JSON.stringify({}) }),


};