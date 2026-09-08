# FAST07 Backend-Connected Foundation

This package adds a real server/API and PostgreSQL schema to the existing virtual/demo UI.

## Important
The existing UI is still a browser/localStorage demo. The API is the shared-data layer. To make every existing screen use the server as its source of truth, wire the UI actions to the API endpoints below instead of localStorage.

## API
- POST /api/auth/signup
- POST /api/auth/login
- GET /api/me
- GET /api/transactions
- POST /api/requests/deposit
- POST /api/requests/withdrawal
- GET /api/my-requests
- GET /api/admin/users
- PATCH /api/admin/users/:id
- GET /api/admin/requests
- POST /api/admin/requests/:id/approve
- POST /api/admin/requests/:id/reject
- GET /api/admin/activities

## Local setup
1. Install Node.js 20+ and PostgreSQL 16+.
2. Create database `fast07` and user `fast07`.
3. Copy `.env.example` to `.env` and set a strong JWT_SECRET and database URL.
4. Run `npm install`.
5. Run `psql "$DATABASE_URL" -f schema.sql`.
6. Run `npm start`.
7. Open http://localhost:3000.

For production, use HTTPS, a managed PostgreSQL database, a strong secret, rate limiting, secure cookies/token storage, input validation, audit logs, backups, and a real deployment platform.

This project is for virtual/demo coins. It does not implement real-money gambling or payment processing.
