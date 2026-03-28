ReturnLocal

Next.js + Convex MVP for local return jobs.

## Getting Started

### 1) Start Convex (dev)

This repo supports both:

- **Local backend** (what you’ve been using): Convex runs on `http://127.0.0.1:3212`.
- **Convex Cloud**: Convex runs on `https://<deployment>.convex.cloud`.

#### Option A: Convex Cloud

1) Log in with the CLI (opens a browser):

```bash
npx convex login
```

2) Link this project to a Convex cloud deployment (the CLI will prompt you to create/select a project on first run):

```bash
npx convex dev
```

The first time, the CLI will prompt you to create/select a project and will update your local config.

3) Ensure your Next.js env points at your cloud deployment URL:

- Set `NEXT_PUBLIC_CONVEX_URL` to the deployment URL printed by the CLI.

#### Option B: Local backend

If you want to use the local backend, run `npx convex dev` while your project is configured for local development (you’ll see the local ports like 3212/3213 in the output).

### 2) Start Next.js

```bash
npm run dev
```

Open `http://localhost:3000/home`.

If port 3000 is busy, Next will auto-pick a different port and print it.

### Magic link (dev)

Email magic links are printed to the **terminal running** `npx convex dev` (see `convex/auth.ts`, `sendVerificationRequest`).

Key pages:

- `/home` – map + nearby jobs
- `/post-job` – create a job (geocodes address)
- `/signin` – email magic link sign-in
- `/jobs/[id]` – job detail + bids + accept flow

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Deploy

For Vercel, set `NEXT_PUBLIC_CONVEX_URL` to your **Convex Cloud** deployment URL.
