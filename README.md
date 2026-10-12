# BookLeaf Author Support & Communication Portal

BookLeaf is a full-stack author support portal built with React, Express, and MongoDB. Authors can view books and royalty data, submit support tickets, and track ticket status. Admin users can review ticket queues, assign staff, update status, and respond to author issues.

## Project structure

- `backend/` — Express API, MongoDB models, auth, ticketing, and AI fallback routes
- `frontend/` — React + Vite client

## Prerequisites

- Node.js 18+
- npm 9+
- MongoDB Atlas or any reachable MongoDB deployment
- A browser with local access to the frontend and backend ports

## Environment setup

Create local environment files from the examples before running the app.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Required backend variables:

- `PORT=5000`
- `CLIENT_URL=http://localhost:5173`
- `MONGODB_URI=mongodb+srv://...`
- `JWT_SECRET=<long-random-secret>`
- `JWT_EXPIRES_IN=1d`
- `BOOK_UPLOAD_DIR=./private-uploads` (private manuscript and cover storage; use a persistent volume in production)
- `ADMIN_EMAIL=admin@example.com`
- `ADMIN_PASSWORD=<12+ chars>`
- `DEMO_AUTHOR_PASSWORD=<12+ chars>`

Frontend variable:

- `VITE_API_URL=http://localhost:5000/api`

Important:
- Never commit `.env` files.
- Use strong passwords and a long JWT secret.
- Keep `CLIENT_URL` aligned with the frontend origin used in development or production.

## Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

## Start the app

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

The backend listens on port 5000 by default. The frontend dev server listens on port 5173 by default.

## Seed demo users and reset admin credentials

Use the project-provided scripts after the backend `.env` file is configured.

```bash
cd backend
npm run create-demo-users
npm run reset-admin
```

These scripts create or update the configured admin account and author accounts used for local testing. The admin email must not conflict with an author email in the data set.

## Authentication and authorization

The project uses JWT bearer tokens.

- Public routes: `/api/health`, `/api/auth/login`, `/api/auth/logout`
- Authenticated routes require `Authorization: Bearer <token>`
- Authors can only access their own author and ticket records unless they are admins
- Admin routes are gated behind `requireAdmin`

Login example:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"<admin-password>"}'
```

The response includes a JWT token that the client stores in localStorage and reuses during subsequent requests.

## Ticketing API

Core endpoints:

- `POST /api/tickets` — create a new ticket as an author
- `GET /api/tickets/my-tickets` — list current author tickets
- `GET /api/tickets/:ticketId` — fetch a ticket by ID
- `POST /api/tickets/:ticketId/replies` — add a reply
- `PATCH /api/tickets/:ticketId/status` — update status (admin only)
- `PATCH /api/tickets/:ticketId/assign` — assign support agent (admin only)
- `PATCH /api/tickets/:ticketId/priority` — update priority (admin only)
- `GET /api/tickets` — admin queue with search/filter support
- `GET /api/tickets/stats` — admin summary metrics

AI endpoints:

- `POST /api/ai/classify-ticket` — category classification (admin only)
- `POST /api/ai/priority` — triage priority (admin only)
- `POST /api/ai/draft-response` — generate a draft response (admin only)
- `POST /api/ai/:ticketId/ai-draft` — save an AI draft to a ticket (admin only)

The project is configured to use a safe fallback rule-based provider when an external AI service is not configured. The UI should require a human admin to review the draft before sending a ticket reply.

## Book submission and publishing workflow

Authors can submit a title with synopsis, genre, language, optional ISBN, a PDF/DOCX manuscript (up to 20 MB), and a PNG/JPG/WebP cover (up to 5 MB). Uploads are stored outside the public web root under `BOOK_UPLOAD_DIR`; file metadata and workflow history are stored on the existing `Book` records. Use a persistent, access-controlled volume for `BOOK_UPLOAD_DIR` in production. Do not mount or serve this directory as static content.

Author endpoints:

- `POST /api/books/submissions` — submit a book as the authenticated author (`multipart/form-data`)
- `GET /api/books/my-books` — list existing titles and submission statuses
- `GET /api/books/:bookId` — retrieve an owned book/submission
- `GET /api/books/:bookId/files/manuscript` and `/cover` — retrieve private files after authorization
- `PATCH /api/books/:bookId` — edit and resubmit a submission only when changes were requested

Admin endpoints:

- `GET /api/books/submissions` — search and filter submissions by status and genre/title/author
- `PATCH /api/books/:bookId/start-review` — move a newly received submission into review
- `PATCH /api/books/:bookId/review` — approve, reject, or request changes (explanation required for rejection/change requests)
- `PATCH /api/books/:bookId/publication-details` — set publication date and price after approval
- `POST /api/books/:bookId/publish` — explicitly mark a prepared, approved book as published

Status changes and feedback are retained in the book's review history and displayed to the author as in-app updates. There is no email notification provider or public book catalogue configured. “Published” records an internal BookLeaf publication state only; it does not imply external marketplace distribution.

## Testing

Run the backend test suite:

```bash
cd backend
npm test
```

Run the frontend production build:

```bash
cd frontend
npm run build
```

## Deployment notes

Before deployment:

- Set `NODE_ENV=production`
- Configure a real MongoDB URI and IP allowlist
- Set `CLIENT_URL` to the production frontend domain
- Use a strong random `JWT_SECRET`
- Ensure the admin and demo accounts are provisioned with secure passwords
- Keep the backend behind TLS and do not expose `.env` values in the repo or build output

The app does not currently include a full external AI provider integration; it uses a deterministic fallback response system when no external AI service is configured.

## Manual acceptance checks

Use the browser to confirm the following flows:

1. Log in as an admin and as an author.
2. Author dashboard loads real totals from `/api/dashboard/author`.
3. Books list loads from `/api/books/my-books`.
4. Author submits a ticket using the ticket form and sees it in `/author/tickets`.
5. Admin opens the ticket queue and reviews the ticket.
6. Admin generates an AI draft, reviews it, and sends a final response.
7. Admin changes status or priority on a ticket.
8. Attempt to access another author’s ticket from a different account and confirm it is blocked.
9. Log out and confirm the app redirects to `/login`.
10. Submit a PDF or DOCX manuscript and cover as an author and confirm its Submitted status in My Books.
11. Review the submission as an admin, request changes, and confirm the author can edit and resubmit.
12. Approve the resubmission, save publication details, then explicitly publish it.
13. Confirm the author sees Published and publication details after logging in again; verify no public catalogue route is available.

API checks:

```bash
curl -i http://localhost:5000/api/health
curl -i http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"<admin-password>"}'
curl -i http://localhost:5000/api/tickets/my-tickets -H "Authorization: Bearer <token>"
```

## Release status

The repository currently passes the local automated backend tests and the frontend production build. A live Atlas MongoDB connection and external AI provider were not verified in this environment, so those external checks remain to be confirmed in a deployment environment with the real credentials installed.
