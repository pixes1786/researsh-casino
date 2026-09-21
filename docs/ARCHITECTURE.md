# Architecture

## Overview

    Browser (React 18)
        |  HTTPS + WebSocket
        v
    Next.js 14 (apps/web)
        |  REST /api/*
        v
    NestJS 10 (apps/api)
        |
        +-- PostgreSQL 16 (Prisma)
        +-- Redis 7 (sessions, throttler)
        +-- BullMQ (planned)

## Monorepo layout

    research-casino/
    |-- apps/
    |   |-- api/        NestJS backend
    |   `-- web/        Next.js frontend
    |-- packages/
    |   |-- rng/        provably-fair RNG
    |   `-- types/      shared TS types
    |-- docker/
    |-- docs/
    `-- docker-compose.yml

## Backend modules (NestJS)

| Module           | Responsibility                                      |
|------------------|-----------------------------------------------------|
| PrismaModule     | Prisma client singleton                             |
| AuthModule       | Registration, login, JWT, 2FA (TOTP), sessions      |
| SecurityModule   | SecurityEvent tracking                              |
| WalletModule     | Balance, ledger, atomic transfers                   |
| GamesModule      | Catalog, live feed                                  |
| RouletteModule   | Server-authoritative spins, provably fair, anti-abuse |
| PromoModule      | Daily bonus, missions, loyalty, VIP, tournament     |
| MeModule         | User profile, bets, rounds, seed history            |
| AdminModule      | Dashboard, users, games, ledger, audit, security    |
| LiveModule       | WebSocket gateway for live wins ticker              |

## Data flow — roulette spin

1. Client -> POST /games/roulette/bet { bets: [{bet, amount}] }
2. JwtGuard verifies cookie -> req.user.sub
3. ThrottlerGuard rate-limits (30/min per IP+route)
4. RouletteService.placeBet:
   - loads active FairnessSeed (or creates one)
   - debits wallet via WalletService.applyEntry (Serializable tx)
   - computes outcome = spinRoulette(serverSeed, clientSeed, nonce)
   - grades each bet using payoutMultiplier
   - computes anti-abuse riskyWager
   - persists GameRound + Bet[] + LedgerEntry(ies)
   - bumps nonce
5. PromoService.trackBet(riskyWager, wonNet, netProfit) updates missions / loyalty / tournament
6. If win > 0 -> broadcast via LiveGateway (live:win)
7. Response: outcome, win, balance, wageredForRewards, hedged, verified

## Provably fair

- serverSeed = randomBytes(32).hex, kept secret until rotation
- serverSeedHash = SHA256(serverSeed) published before spin
- per spin: digest = HMAC_SHA256(serverSeed, clientSeed:nonce:cursor)
- first 4 bytes as uint32, rejection sampling for 38 pockets
- player rotates seed -> old serverSeed revealed; verify by recomputing
- round stored with (serverSeed, serverSeedHash, clientSeed, nonce) for audit

## Ledger

- Wallet.balance denormalized for fast reads
- every change writes immutable LedgerEntry (type, amount, balanceAfter, refType, refId, reason, requestId)
- Serializable transactions; negative balance rejected
- admin adjustments go through same path (type ADJUSTMENT + reason)

## Anti-abuse

Complementary bets cancel each other:
- red + black
- odd + even
- low + high
- all 3 dozens equal
- all 3 columns equal

Only riskyWager = total - cancelled counts toward missions, loyalty, tournaments, VIP.
Enforced server-side, persisted on every GameRound as wageredForRewards.

## Security

- Argon2id password hashing (memoryCost 19456, timeCost 2)
- httpOnly, SameSite=Lax, Secure-in-prod cookies; access token 15m
- TOTP 2FA mandatory for ADMIN/SUPERADMIN/RISK — RolesGuard blocks if JWT mfa !== true
- Strict Helmet CSP in production; HSTS; Permissions-Policy; frame-ancestors none
- Rate limiting: auth 8-10/min, wallet 30/min, bets 30/min, default 120/min
- Structured JSON logs with requestId
- SecurityEvent table tracks logins, MFA events, suspicious activity
