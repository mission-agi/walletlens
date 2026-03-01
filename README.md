# WalletLens

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=flat&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat&logo=prisma&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

A personal finance dashboard built with Next.js. Upload bank statements (CSV/PDF), track spending by category, manage investment portfolios, and view household-level financial summaries.

## Features

- **Dashboard** — Monthly spending overview with category breakdowns, trend charts, and recent transactions. Supports month/year navigation and custom date ranges.
- **Upload** — Drag-and-drop CSV and PDF bank statement parsing with automatic transaction extraction. Supports bulk uploads with progress tracking.
- **Transactions** — Full transaction list with inline editing, category assignment, search, and CSV export.
- **Accounts** — Manage bank accounts (checking, savings, credit card, investment). Supports multi-user households.
- **Portfolio** — Track investment holdings, cost basis, and unrealized gains/losses.
- **Reports** — Detailed spending reports with category breakdowns, daily spending trends, and period comparisons.
- **Annual** — Year-over-year financial summary with monthly income/expense grids.
- **Household** — Combined view across all household members with per-user breakdowns.
- **Settings** — Profile management, user switching, and data management.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js](https://nextjs.org) 16 — App Router, Server Components |
| Database | SQLite via [Prisma](https://www.prisma.io) |
| Styling | [Tailwind CSS](https://tailwindcss.com) v4 |
| Charts | [Recharts](https://recharts.org) |
| Language | TypeScript (strict mode) |
| Validation | [Zod](https://zod.dev) |
| Parsing | PapaParse (CSV), pdf-parse (PDF) |

## Quick Start

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
git clone https://github.com/<your-username>/walletlens.git
cd walletlens
npm install
cp .env.example .env
```

```bash
npx prisma generate
npx prisma db push
npx prisma db seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you're ready to go.

### Environment Variables

See [`.env.example`](.env.example) for all available configuration options.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `file:./dev.db` | SQLite database path |
| `LOG_LEVEL` | No | `debug` (dev) / `info` (prod) | Logging verbosity |
| `NEXT_PUBLIC_GITHUB_FEEDBACK_REPO` | No | _unset_ | Target repo for in-app feedback issues (`owner/repo`) |

## Project Structure

```
src/
├── app/                  # Next.js App Router pages and API routes
│   ├── api/              # REST API endpoints
│   ├── accounts/         # Account management page
│   ├── annual/           # Annual summary page
│   ├── household/        # Household combined view
│   ├── portfolio/        # Investment portfolio page
│   ├── reports/          # Spending reports page
│   ├── settings/         # Settings page
│   ├── transactions/     # Transaction list page
│   ├── upload/           # Statement upload page
│   └── page.tsx          # Dashboard (home page)
├── components/           # React components
│   ├── charts/           # Recharts wrappers (pie, bar)
│   ├── dashboard/        # Dashboard-specific components
│   ├── profile/          # Profile switcher
│   ├── reports/          # Report components
│   └── ui/               # Shared UI primitives (Card, Badge, etc.)
├── lib/                  # Business logic
│   ├── parsers/          # CSV and PDF statement parsers
│   ├── queries/          # Database query functions
│   ├── categorizer.ts    # Auto-categorization engine
│   ├── db.ts             # Prisma client singleton
│   ├── security.ts       # Auth, rate limiting, audit logging
│   └── utils.ts          # Formatting and helper utilities
└── prisma/
    └── schema.prisma     # Database schema
```

## License

[MIT](LICENSE)
