# Code Verification System

A full-stack web app that checks whether a code is **valid**, **already used**, or **expired/invalid**, with an admin console for creating and managing codes.

- A code can **never be redeemed twice**. Redemption is one atomic database operation, backed by a second guard (a unique index), so concurrent requests cannot both win.
- The **server** decides every verification result. The browser stores no codes.
- Admin features (add, generate, list, export, delete, statistics, batches) require a signed-in admin.

## Features

**Public**: verification page with loading state and clear Valid / Already Used / Expired-Invalid results. Input is trimmed and case-insensitive (`abcd-1234-efgh` equals `ABCD-1234-EFGH`). Rate limited. Reveals nothing else about the database.

**Admin**: sign in (JWT in an HTTP-only cookie, bcrypt-hashed password), dashboard statistics, searchable/filterable/paginated code table, add a code manually (optional expiry), generate up to 10,000 random codes per request in a numbered batch (`BATCH-2026-001`), CSV export, delete, batch overview (generated / used / unused), change password.

## Tech stack

React 18 + Vite + Axios + React Router · Node.js + Express + Mongoose · MongoDB · JWT + bcrypt · Helmet, CORS, express-rate-limit · Node's built-in test runner + supertest.

## Folder structure

```
code-verification-system/
├── backend/
│   ├── controllers/   verify, auth, admin logic
│   ├── middleware/    auth, rate limiters, error handler
│   ├── models/        Code, Admin, Batch, Redemption
│   ├── routes/        route table
│   ├── scripts/       seedAdmin.js
│   ├── tests/         api.test.js
│   ├── utils/         code generation, CSV, batch numbering
│   ├── app.js         Express app (importable for tests)
│   ├── server.js      DB connection + listen
│   └── .env.example
├── frontend/
│   └── src/ components/ pages/ services/ App.jsx main.jsx index.css
├── README.md
└── .gitignore
```

## 1. MongoDB setup

Pick one:

- **Local install**: install MongoDB Community Server (https://www.mongodb.com/docs/manual/installation/) and start it. Default URI: `mongodb://127.0.0.1:27017/code-verification`.
- **Docker**: `docker run -d --name cvs-mongo -p 27017:27017 -v cvs-mongo-data:/data/db mongo:7`
- **MongoDB Atlas** (hosted, free tier): create a cluster, add a database user, allow your IP, copy the `mongodb+srv://…` connection string.

## 2. Environment variables

```
cd backend
cp .env.example .env
```

| Variable | Meaning |
| --- | --- |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Random string, **at least 32 characters**. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `PORT` | API port (default `5000`) |
| `CLIENT_URL` | Allowed browser origin(s), comma-separated (default `http://localhost:5173`) |
| `NODE_ENV` | `production` makes the auth cookie `Secure` |
| `COOKIE_SAMESITE` | Optional. `lax` (default) or `none` if the frontend and API are on different sites (requires HTTPS) |
| `TRUST_PROXY` | Optional. Set to `1` when behind a reverse proxy so rate limiting sees real client IPs |

`.env` is git-ignored. Never commit it.

## 3. Install and run

```
# terminal 1: backend  (http://localhost:5000)
cd backend
npm install
npm run dev

# terminal 2: frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```

In development the Vite dev server proxies `/api` to `localhost:5000`, so the browser uses one origin and cookies just work. CORS is configured for `CLIENT_URL` as well.

## 4. Create the first admin

```
cd backend
npm run seed:admin
```

You are prompted for an email and a password (min 10 characters, input hidden). The password is hashed with bcrypt (cost 12). Running it again for the same email resets that admin's password. For scripted setups, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables instead of using the prompts. No default account exists. Sign in at http://localhost:5173/admin.

## 5. Tests

```
cd backend
npm test
```

Needs a running MongoDB. Uses the database `cvs-test` on `mongodb://127.0.0.1:27017` (override with `TEST_MONGO_URI`); it clears the Code, Admin and Redemption collections of that database, so never point it at real data. Covers: valid / invalid / used codes, normalization, expiry, operator-injection input, duplicate and manual creation, random generation, unauthorized access, admin login, stats/list/export/batches/delete, and **100 simultaneous requests for one code, exactly one succeeds**.

## 6. How double-redemption is prevented

1. `findOneAndUpdate({ code, status: 'unused', not expired }, { status: 'used', usedAt })` is a single atomic MongoDB operation. Only one request can match and modify the document.
2. The winner then inserts a record into `Redemption`, which has a **unique index on `code`**. A duplicate-key error means another request already won, and the request is answered "already used".

Step 1 alone is sufficient on MongoDB. Step 2 is defense in depth: it makes the guarantee rest on a unique constraint, which every database enforces atomically. If step 2 fails for a non-duplicate reason (e.g. connection loss), the code stays consumed rather than risk a second redemption.

## 7. API

All responses are JSON. Errors look like `{ "success": false, "code": "…", "message": "…" }`.

### Public
`POST /api/codes/verify` body `{ "code": "ABCD-1234-EFGH" }`

| Outcome | HTTP | Body |
| --- | --- | --- |
| Valid | 200 | `{ "success": true, "status": "valid", "message": "Code verified successfully." }` |
| Already used | 409 | `{ "success": false, "status": "used", "message": "Code has already been used." }` |
| Invalid / expired | 404 | `{ "success": false, "status": "invalid", "message": "Code is invalid or expired." }` |
| Rate limited | 429 | `{ "success": false, "status": "rate_limited", … }` (30 requests per 15 min per IP) |

### Auth
- `POST /api/auth/login` `{ email, password }` sets the `cvs_token` HTTP-only cookie (8 h). Limited to 10 attempts per 15 min per IP.
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/change-password` `{ currentPassword, newPassword }`

### Admin (cookie or `Authorization: Bearer <jwt>` required)
- `GET /api/admin/stats` → `{ stats: { total, unused, used, expired } }`
- `GET /api/admin/codes?page=1&limit=20&search=ABC&status=used&batchId=BATCH-2026-001`
- `POST /api/admin/codes` `{ code, expiresAt? }` (409 `DUPLICATE_CODE` if it exists)
- `POST /api/admin/codes/generate` `{ count (1–10000), format: "XXXX-XXXX-XXXX", expiresAt? }` → `{ batchId, count, codes[] }`
- `DELETE /api/admin/codes/:id`
- `GET /api/admin/codes/export?status=&search=&batchId=` → CSV
- `GET /api/admin/batches`

Generated codes use Node's `crypto` with an unbiased sampler over `ABCDEFGHJKMNPQRSTWXYZ23456789` (no O/0, I/1, L, U/V). Uniqueness is guaranteed by the unique index; any collision is regenerated.

### Example requests
```
curl -X POST http://localhost:5000/api/codes/verify \
  -H 'Content-Type: application/json' -d '{"code":"abcd-1234-efgh"}'

curl -c jar -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"you@example.com","password":"…"}'

curl -b jar -X POST http://localhost:5000/api/admin/codes/generate \
  -H 'Content-Type: application/json' -d '{"count":100,"format":"XXXX-XXXX-XXXX"}'

curl -b jar -o codes.csv http://localhost:5000/api/admin/codes/export
```

## 8. Deployment

1. **Database**: use MongoDB Atlas (or a managed/replica-set MongoDB). Restrict network access and use a dedicated database user.
2. **Backend** (Render, Railway, Fly.io, a VM…): `cd backend && npm ci --omit=dev && npm start`. Set `NODE_ENV=production`, `MONGO_URI`, a strong `JWT_SECRET`, `CLIENT_URL` (your frontend's exact origin), and `TRUST_PROXY=1` behind a proxy/load balancer. Serve over HTTPS (the auth cookie is `Secure` in production). Run `npm run seed:admin` once against the production database.
3. **Frontend**: `cd frontend && npm run build`, then host `dist/` on any static host (Netlify, Vercel, Cloudflare Pages, Nginx). Configure SPA fallback to `index.html`.
   - Same domain (recommended): route `/api/*` to the backend with your reverse proxy. Nothing else needed.
   - Different domains: build with `VITE_API_URL=https://api.example.com`, set backend `CLIENT_URL=https://app.example.com`, and set `COOKIE_SAMESITE=none` (HTTPS required).
4. Back up the database, and rotate `JWT_SECRET` if it is ever exposed (this signs everyone out).

## Security notes

Helmet headers; CORS limited to `CLIENT_URL` with credentials; JSON body limit of 10 KB; strict type checks on all inputs (blocks NoSQL operator injection); regex search input escaped; bcrypt (cost 12) with constant-time-ish login for unknown emails; JWT pinned to HS256 and re-checked against the database on each request; HTTP-only, `SameSite=Lax` cookie; rate limits on verification and login; CSV export neutralizes spreadsheet formulas; centralized error handler never leaks stack traces. Because JWTs are stateless, logout clears the cookie but a stolen token stays valid until it expires (8 h); rotate `JWT_SECRET` to revoke all sessions.
