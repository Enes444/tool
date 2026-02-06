# Work in Progress – nächster Schritt (Pilot-Ready UX)

Stand: 2026-02-05

## Ziel
Die App soll sich wie ein “fertiges Tool” anfühlen: **Edit / Save / Cancel / Archive / Restore / Zurück / Breadcrumbs** überall konsistent – inkl. **Tickets & Claims**, damit nichts “unendlich” wächst.

## Aktuelle Lücken (UI/Produkt)
1) **Edit/Update ist nicht überall durchgängig**
   - Org/Sponsor/Deal-Daten sind nur teilweise bearbeitbar.
2) **Löschen fehlt (sollte Archivieren sein)**
   - Empfehlung: **Soft-Archive** statt Hard-Delete (Undo möglich).
3) **Zurück/Breadcrumbs uneinheitlich**
   - Auf jeder Detailseite: Breadcrumb + klarer Back-Button.
4) **Tickets/Claims brauchen Lifecycle**
   - Status (open/pending/closed; submitted/approved/denied/paid) + Archive/Restore + Filter „archivierte anzeigen“.
5) **Login-Seite zeigt Demo-Creds**
   - Hinweis entfernen oder dynamisch machen (Bootstrap-Flow erklären).

## Empfohlene Umsetzung (ohne Rückfragen, pilot-tauglich)
### A) Backend (API)
- Für **Tickets**:
  - `archived_at` + `POST /tickets/{id}/archive`, `/restore`
  - `PATCH /tickets/{id}` (status/priority/subject/body)
  - Listen: `include_archived=false` default
- Für **Claims**:
  - `archived_at` + `POST /claims/{id}/archive`, `/restore`
  - `PATCH /claims/{id}` (status/payout/notes)
  - Listen: `include_archived=false` default
- Für **Sponsoren/Deals/Deliverables**:
  - konsistente Archive/Restore Endpunkte + Filter in Listen

### B) Frontend (UX)
- **Einheitliche Action-Leiste** auf jeder Detailseite:
  - Edit → Save/Cancel
  - Archive/Restore (mit Confirm)
  - Toast mit Undo (Restore)
- **Breadcrumbs + Back**:
  - Org → Sponsor → Deal → Deliverable / Tickets / Claims
- **Listen**:
  - Toggle „Archivierte anzeigen“
  - Default: nur aktive Einträge

## Tech-Schulden (nach Pilot / P1)
- DB-Migrationen (Alembic) statt `create_all()`
- Observability light (Sentry/Logs/Metrics)
- Storage (S3/MinIO) wenn Uploads wachsen