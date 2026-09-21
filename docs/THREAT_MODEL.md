# Threat Model (STRIDE)

## Assets

1. User credentials (password hashes, TOTP secrets, recovery codes)
2. Wallet balances and ledger integrity
3. Game outcomes (server seed, RNG state)
4. Admin actions (audit trail, permissions)
5. Personal data (email, username, IP, UA)
6. Fairness proofs (server seed, client seed, nonce)

## Spoofing

| Threat                    | Mitigation                                                  |
|---------------------------|-------------------------------------------------------------|
| Stolen JWT / cookie       | httpOnly, SameSite=Lax, 15m TTL, 7d refresh                 |
| Brute force login         | Rate limit 8/min + SecurityEvent + Argon2id cost            |
| Credential stuffing       | Rate limit + MFA for admin roles                            |
| Fake admin via role bug   | RolesGuard deny-by-default + requires mfa:true in JWT       |

## Tampering

| Threat                              | Mitigation                                              |
|-------------------------------------|---------------------------------------------------------|
| Client-side bet manipulation        | Server recomputes bets, RNG is server-side only         |
| Direct DB writes bypassing ledger   | App uses WalletService.applyEntry exclusively           |
| Race condition on balance           | Serializable isolation + atomic increment               |
| Hedge abuse for rewards             | riskyWager cancels complementary bets                   |

## Repudiation

| Threat                            | Mitigation                                              |
|-----------------------------------|---------------------------------------------------------|
| "I didn't place that bet"         | GameRound persisted with hash + nonce; ledger entry     |
| "Admin didn't change my role"     | AuditLog captures actor, IP, UA, diff, reason           |
| Denied login attempt              | SecurityEvent logs all login successes/failures         |

## Information Disclosure

| Threat                          | Mitigation                                              |
|---------------------------------|---------------------------------------------------------|
| Password hash leak              | stripSensitive() in audit diff; truncated hash for admins |
| Server seed leak pre-reveal     | Only serverSeedHash exposed; seed revealed on rotation  |
| Error stack traces              | Global error handler; no stack in responses             |
| Cross-origin data leak          | CORS whitelist                                          |
| Referrer leak                   | Referrer-Policy: strict-origin-when-cross-origin        |

## Denial of Service

| Threat               | Mitigation                                    |
|----------------------|-----------------------------------------------|
| Login flood          | @Throttle auth 8-10/min                       |
| Bet spam             | @Throttle bets 30/min                         |
| Large payload        | class-validator rejects unknown fields        |
| Slow queries         | Indexed createdAt, userId; caps 200-300       |

## Elevation of Privilege

| Threat                    | Mitigation                                          |
|---------------------------|-----------------------------------------------------|
| User hits /admin/*        | JwtGuard + RolesGuard with explicit @Roles()        |
| Admin without MFA         | RolesGuard rejects ADMIN/SUPERADMIN/RISK without MFA |
| Self-demotion bug         | admin.updateUser rejects self-demotion              |
| SQL injection             | Prisma parameterized queries only                   |
| XSS via user input        | React escaping; CSP in production                   |

## Out of scope (research prototype)

- Real-money fraud, AML/KYC
- Card networks, 3-D Secure
- Physical security of the data center

## Residual risk

- No WAF layer in dev — add in production deploy
- No rate limit on WebSocket messages yet
- No key rotation for JWT_SECRET — use Vault/secret manager in prod
- No SAST/DAST in CI yet (planned)
