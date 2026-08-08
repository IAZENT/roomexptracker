# RoomMate
<img width="1920" height="964" alt="image" src="https://github.com/user-attachments/assets/f7dc0bd3-f2cb-4fbe-959f-d6a752f25d18" />

Track. Split. Settle.

A shared-room expense tracker built for roommates splitting rent, utilities,
and day-to-day purchases. Built with Next.js and Supabase.

## Features

- **Households with invite codes** — create a household, share a 6-character
  code so roommates can join.
- **Billing cycles** — each household picks its own cycle-end day (not
  necessarily the calendar month); cycles auto-close and roll over.
- **Fixed bills** — rent, water, electricity, waste, or any custom bill type,
  tracked per cycle and split across active members.
- **Expense entry** — itemized purchases (name + cost per item), split evenly
  by default or restricted to a chosen subset of members (e.g. excluding a
  roommate who doesn't eat meat).
- **Coverage (`pays_for`)** — one member can cover another's share entirely
  (e.g. siblings sharing one wallet), redirecting their portion instead of
  splitting it separately.
- **Settled expenses** — purchases where everyone paid their share on the
  spot (e.g. gas) still count toward spending history without creating any
  debt to track.
- **Settle-up view** — real "who owes whom" balances, simplified with a
  greedy debt-reduction algorithm so roommates make the fewest possible
  payments to settle.
- **Receipts** — per-member itemized breakdown snapshotted on cycle close,
  exportable as PDF/PNG.
- **Personal + shared dashboards** — a personal view (what you've paid, your
  total responsibility, what's left to pay) and a shared household view
  (cycle totals, expense list, insights charts).
- **Shopping mode** — offline-first item list that syncs to the current
  cycle when back online.
- **Installable PWA** — works as a home-screen app on mobile.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Supabase](https://supabase.com) (Postgres, Auth, Row Level Security)
- Tailwind CSS + [shadcn/ui](https://ui.shadcn.com)
- [Recharts](https://recharts.org) for insights charts
- Deployed on [Vercel](https://vercel.com)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

You'll need a Supabase project with the schema from `supabase/migrations/`
applied, and the following environment variables in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_DB_URL=
```

Apply migrations with:

```bash
npx supabase db push --db-url "$SUPABASE_DB_URL"
```
