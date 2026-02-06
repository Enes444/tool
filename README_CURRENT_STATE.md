# Sponsor Ops – aktueller Stand (Snapshot 2026-02-05)

Dieses ZIP enthält den **aktuellen lauffähigen Stand** (Backend + Frontend) inklusive P0-Härtungen (JWT-Secret Pflicht, Admin-Bootstrap, Frontend Production Build via nginx).

> Hinweis: In der UI steht auf der Login-Seite noch „Demo: admin@example.com / admin123“. **Diese Demo-Credentials werden NICHT automatisch angelegt.**
> Du musst den Admin **einmalig bootstrappen** (siehe unten) oder den Hinweis später entfernen/anpassen.

## Inhalte
- **backend/**: FastAPI + SQLModel
- **frontend/**: React (Vite) → Production Build, ausgeliefert via nginx
- **docker-compose.yml**: Startet `api` und `web`

## Quickstart (Windows PowerShell)

1) `.env` anlegen