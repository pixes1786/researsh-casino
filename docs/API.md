# API Reference

Base URL: http://localhost:3001

Auth: httpOnly cookie access_token set by /auth/login or /auth/register.
All responses JSON. Errors: { statusCode, message }.

## Auth

| Method | Path                 | Body                                |
|--------|----------------------|-------------------------------------|
| POST   | /auth/register       | { email, username, password }       |
| POST   | /auth/login          | { email, password, code? }          |
| POST   | /auth/logout         | -                                   |
| GET    | /auth/me             | -                                   |
| GET    | /auth/2fa/status     | -                                   |
| POST   | /auth/2fa/setup      | -                                   |
| POST   | /auth/2fa/enable     | { code }                            |
| POST   | /auth/2fa/disable    | { code }                            |

## Wallet

| Method | Path             | Notes                        |
|--------|------------------|------------------------------|
| GET    | /wallet          | { currency, balance }        |
| GET    | /wallet/ledger   | Last 50 entries              |

## Games

| Method | Path                 | Notes                          |
|--------|----------------------|--------------------------------|
| GET    | /games               | ?category=&search=             |
| GET    | /games/live-feed     | Recent wins                    |
| GET    | /games/:slug         | Game detail                    |

## Roulette

| Method | Path                                | Notes                     |
|--------|-------------------------------------|---------------------------|
| GET    | /games/roulette/seed                | Current seed status       |
| POST   | /games/roulette/seed/client         | { clientSeed }            |
| POST   | /games/roulette/seed/rotate         | Reveal current server seed |
| POST   | /games/roulette/bet                 | { bets: [{bet, amount}] } |
| GET    | /games/roulette/verify/:roundId     | Recompute outcome         |

Bet types:

    { kind: 'straight', number: 0..37 }   // 37 = "00"
    { kind: 'column', column: 1|2|3 }
    { kind: 'dozen', dozen: 1|2|3 }
    { kind: 'red' } | { kind: 'black' }
    { kind: 'odd' } | { kind: 'even' }
    { kind: 'low' } | { kind: 'high' }

Response includes wageredForRewards and hedged (anti-abuse).

## Me

| Method | Path            | Notes              |
|--------|-----------------|--------------------|
| GET    | /me/profile     | Profile + stats    |
| GET    | /me/bets        | Latest bets        |
| GET    | /me/rounds      | Latest rounds      |
| GET    | /me/sessions    | Seed history       |

## Promo

| Method | Path                          | Notes                       |
|--------|-------------------------------|-----------------------------|
| GET    | /promo/daily                  | Daily bonus status          |
| POST   | /promo/daily/claim            | Claim                       |
| GET    | /promo/missions               | Missions with progress      |
| POST   | /promo/missions/:id/claim     | Claim reward                |
| GET    | /promo/tournament             | Tournament + leaderboard    |
| GET    | /promo/vip                    | VIP tier progress           |

## Admin (role-gated, MFA required)

| Method | Path                        | Notes                        |
|--------|-----------------------------|------------------------------|
| GET    | /admin/dashboard            | GGR/NGR, activity            |
| GET    | /admin/users                | ?search=&role=&status=       |
| GET    | /admin/users/:id            | Detail + ledger + bets       |
| PATCH  | /admin/users/:id            | role/status/kyc + reason     |
| POST   | /admin/users/:id/balance    | { delta, reason }            |
| GET    | /admin/games                | All games                    |
| PATCH  | /admin/games/:id            | rtp/playersNow/isActive      |
| GET    | /admin/ledger               | All ledger entries           |
| GET    | /admin/audit                | Admin audit log              |
| GET    | /admin/security             | SecurityEvents               |
| GET    | /admin/security/summary     | 24h aggregate                |

## WebSocket

- live:win — { username, gameSlug, amount, at } on every winning spin
- live:feed — reserved for future live dealer

## Headers

Every response includes x-request-id. Send your own x-request-id to correlate.

Rate limits:

| Scope   | Limit     |
|---------|-----------|
| Default | 120/min   |
| Auth    | 8-10/min  |
| Wallet  | 30/min    |
| Bets    | 30/min    |
