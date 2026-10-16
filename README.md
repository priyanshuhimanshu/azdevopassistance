# Azure DevOps Support AI — Frontend

React + TypeScript + Vite single-page app for the Azure DevOps Support & Incident AI Assistant. It talks to the backend API for dashboards, incidents, reports, and chat.

## Tech Stack

- React 19 + TypeScript
- Vite 7
- DOMPurify + marked (safe markdown rendering)
- Nginx (production container)

## Requirements

- Node.js 20+ (24 recommended)
- npm

## Getting Started

```bash
npm install
npm run dev
```

Dev server runs at http://localhost:5173 and proxies `/api` and `/health` to the backend at `http://127.0.0.1:8000` (see `vite.config.ts`).

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc --noEmit`) and build to `dist/` |
| `npm run preview` | Preview the production build locally |

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_BASE` | `/` | Base public path (e.g. `/azdevopassistance/` for GitHub Pages project sites) |
| `VITE_API_BASE_URL` | `""` (relative) | Absolute backend URL prepended to all `/api/*` requests. Leave empty when serving behind the Nginx proxy. |

Example (`.env.local`):

```bash
VITE_API_BASE_URL=https://your-backend.example.com
```

## Docker

Multi-stage build: Node build stage → Nginx runtime.

```bash
docker build -f frontend/Dockerfile -t azdevops-support-ai-frontend .
docker run -p 8080:80 azdevops-support-ai-frontend
```

Nginx serves the static build and proxies `/api/` and `/health` to `http://backend:8000` (see `nginx.conf`). Use the `docker-compose.yml` at the repo root to run frontend + backend together.

## Deployment

### GitHub Pages

On pushes to `main`, `.github/workflows/deploy-pages.yml` builds and publishes the site.

- Enable Pages: **Settings → Pages → Source = GitHub Actions**.
- Set the backend URL: **Settings → Secrets and variables → Actions → Variables → `VITE_API_BASE_URL`**.
- Published at: https://priyanshuhimanshu.github.io/azdevopassistance/

The workflow sets `VITE_BASE=/<repo>/` automatically for the project site path.

## Project Structure

```
frontend/
  src/
    api.ts            # API client (base URL aware)
    App.tsx           # Root component, tab navigation
    components/       # Dashboard, IncidentTable, IncidentDetail, Reports, Chat
    types.ts          # Shared types
  nginx.conf          # Production Nginx config
  Dockerfile          # Multi-stage build
  .github/workflows/  # CI/CD (GitHub Pages)
```
