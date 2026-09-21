# Research Casino Platform

**Research prototype. Virtual currency only. No real-money gambling. Not for commercial use.**

A faithful-looking online casino mock built for UX research, security research, and
anomaly detection — without any real-money risk.

## Stack

- Backend: NestJS 10 + Prisma 5 + PostgreSQL 16 + Redis 7
- Frontend: Next.js 14 (App Router) + Tailwind + Framer Motion + TanStack Query + Zustand
- Realtime: Socket.IO
- RNG: HMAC-SHA256 + rejection sampling (provably fair, commit-reveal)
- Auth: Argon2id + JWT + TOTP 2FA + recovery codes
- Rate limit / security: @nestjs/throttler + Helmet (strict) + custom SecurityEvent log

## Quick start

    pnpm install
    docker compose up -d postgres redis
    cp .env.example .env
    pnpm --filter @rc/api prisma:generate
    pnpm db:migrate
    pnpm db:seed

    pnpm --filter @rc/api dev      # :3001
    pnpm --filter @rc/web dev      # :3000

Open http://localhost:3000

| Account | Login           | Password   | Role  |
|---------|-----------------|------------|-------|
| Demo    | demo@rc.local   | demo12345  | USER  |
| Admin   | admin@rc.local  | admin12345 | ADMIN |

## Features

### Public
- Landing with hero, live wins ticker, top games
- Lobby with categories, search, filters
- Games catalog (fictional providers: NovaPlay, AuroraSoft, ByteSpin)
- Promotions, VIP Club, Tournaments, Help, Responsible Gaming

### Games
- American Roulette (0/00, 38 pockets, RTP 94.7%) — fully playable
- Slots / Blackjack / Crash / Mines — placeholders
- Provably fair: HMAC-SHA256, commit-reveal, public verification
- Auto-play, turbo, repeat, x2, max bet
- Anti-abuse: hedged bets (red+black, odd+even, all dozens) don't count toward rewards

### Wallet & Promos
- RC balance, ledger with double-entry, immutable audit
- Welcome bonus, daily bonus (7-day streak), missions, cashback
- VIP tiers (Bronze -> Diamond) with progress and perks
- Weekly roulette tournament with prize pool in RC
- Loyalty points
- No deposit, no withdrawal, no payment providers

### User account
- Profile with stats (rounds, bets, wagered, net P/L)
- Security page: TOTP 2FA setup with QR + recovery codes
- Bet history, game rounds, ledger
- Session seeds for fairness verification

### Admin (/admin, role-gated)
- Dashboard: GGR/NGR in RC, active players, hourly activity, top bet types, recent wins
- Users: list with filters, edit role/status/KYC, balance adjustments via ledger
- Games: RTP, playersNow, on/off toggle
- Ledger: all entries with type filter
- Audit log: every admin action with IP, user-agent, diff, reason
- Security events: failed logins, MFA events, rate limits, with severity levels

## Hard constraints

- No real payments, deposits, withdrawals, or currency purchases
- No payment providers, banks, crypto
- No real KYC/AML providers, no real PII
- No affiliate payouts
- No backdoors, hidden admins, master passwords
- All brands/providers/logos are fictional
- Everywhere: Research prototype. Virtual currency only.

## Docs

- docs/ARCHITECTURE.md — system design
- docs/THREAT_MODEL.md — STRIDE + mitigations
- docs/ASVS.md — OWASP ASVS L2 checklist
- docs/RUNBOOK.md — ops, incidents
- docs/RESPONSIBLE_GAMING.md — RG policy
- docs/API.md — endpoint reference

## License

Research use only. Not for commercial use.
