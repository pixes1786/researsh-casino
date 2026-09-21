# Runbook

## Local development

    docker compose up -d postgres redis
    pnpm --filter @rc/api prisma:generate
    pnpm db:migrate
    pnpm db:seed

    pnpm --filter @rc/api dev        # :3001
    pnpm --filter @rc/web dev        # :3000

## Common failures

### EADDRINUSE: address already in use :3001

Old nest process is still alive.

    ps aux | grep -E "nest|node.*api" | grep -v grep
    kill -9 <pid1> <pid2> <pid3>
    sudo lsof -i :3001

Or nuke everything:

    pkill -9 -f "nest.js start"
    pkill -9 -f "apps/api/dist/main"
    sudo fuser -k 3001/tcp

### Prisma: Environment variable not found: DATABASE_URL

.env must be at repo root. Prisma in apps/api/ loads it via symlink:

    ln -sf ../../.env apps/api/.env

### Prisma schema validation error

Multi-line blocks only. generator and datasource must be:

    generator client {
      provider = "prisma-client-js"
    }

Not one-line. Same for enum blocks.

### Wallet balance out of sync with ledger

    SELECT w.balance, SUM(le.amount) AS ledger_sum
    FROM "Wallet" w
    LEFT JOIN "LedgerEntry" le ON le."walletId" = w.id
    GROUP BY w.id
    HAVING w.balance != COALESCE(SUM(le.amount), 0);

If mismatch, do NOT update Wallet directly — write a compensating ADJUSTMENT entry.

### Rate limit misfires during local dev

Restart the API. Throttler uses in-memory storage by default.
For persistent limits, back it by Redis (planned).

## Backup / Restore

    docker exec research-casino-postgres-1 pg_dump -U rc research_casino > backup.sql
    cat backup.sql | docker exec -i research-casino-postgres-1 psql -U rc -d research_casino

## Incident response

1. Suspected credential compromise
   - Rotate JWT_SECRET (invalidates all tokens)
   - Force password reset for the affected user
   - Check /admin/security for anomalous logins

2. Ledger mismatch
   - Freeze writes: set games isActive=false from /admin/games
   - Export LedgerEntry and reconcile per user
   - Add compensating entries with a documented reason

3. Suspicious betting pattern
   - Inspect /admin/users/:id -> rounds + bets
   - Check hedged count in GameRound.result
   - Temporarily SUSPENDED status via admin

4. DDoS / brute force
   - Rate limits absorb most traffic
   - Add IP-level block at reverse proxy (Nginx/Traefik)
   - Enable CAPTCHA (Turnstile) on /auth/login (planned)

## Logs

- API: structured JSON to stdout (parse with jq)
- Security events: SELECT * FROM "SecurityEvent" ORDER BY "createdAt" DESC;
- Admin audit: SELECT * FROM "AuditLog" ORDER BY "createdAt" DESC;

## Production checklist

- [ ] NODE_ENV=production
- [ ] JWT_SECRET from a secret manager
- [ ] DATABASE_URL with SSL + strong password
- [ ] Reverse proxy with TLS (Let's Encrypt)
- [ ] HSTS enabled
- [ ] CSP strict
- [ ] WAF (Cloudflare / fastly) in front
- [ ] Redis for throttler storage
- [ ] Postgres backups scheduled
- [ ] Prometheus/Grafana/Loki wired
- [ ] Alerts on SecurityEvent.severity = 'danger'
- [ ] Bug bounty / responsible disclosure policy
