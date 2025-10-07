# Zealthy — Mini EMR & Patient Portal

A Next.js (App Router) + Prisma + Neon Postgres + NextAuth demo app.

## Features
- **Admin (mini-EMR)** at `/admin`:
  - Manage Patients (CRU)
  - Manage Appointments (CRUD)
  - Manage Prescriptions (CRUD)
- **Patient Portal** at `/`:
  - Login with email/password
  - Upcoming appointments (next 7 days)
  - Refills due (next 7 days)
  - Drilldowns for full schedules

## Tech
- Next.js 14+ (App Router)
- Prisma ORM
- Neon Postgres (serverless, pooled)
- NextAuth (Credentials)

## Local Dev

1. **Env**
   - Create `.env`:
     ```
     DATABASE_URL=postgresql://...dev_branch...?pgbouncer=true&sslmode=require
     NEXTAUTH_URL=http://localhost:3000
     NEXTAUTH_SECRET=your-local-secret
     ```

2. **Install & generate**
   ```bash
   npm install
   npx prisma generate
