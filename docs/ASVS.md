# OWASP ASVS L2 — Targeted Checklist

Legend: YES = implemented, PARTIAL = partial, NO = not implemented (research scope)

## V1 Architecture

- YES Modular NestJS with DI and guards
- YES Deny-by-default authorization
- YES Centralized error handling
- PARTIAL Threat model documented
- PARTIAL Separate dev/prod environment via .env
- NO Formal data-flow diagram tool

## V2 Authentication

- YES Argon2id (memory 19456, iterations 2)
- YES Password min length 8, max 128
- YES Anti-automation via @nestjs/throttler
- YES MFA (TOTP) available; mandatory for admins
- YES Recovery codes for MFA
- YES Session cookie: httpOnly, SameSite=Lax, Secure in prod
- YES Short-lived access token (15m); refresh token (7d)
- PARTIAL Refresh token rotation (planned)
- PARTIAL Device fingerprinting (data model ready)
- NO WebAuthn / passkeys

## V3 Session Management

- YES Cookie-based sessions, no localStorage tokens
- YES Logout clears cookies
- PARTIAL "My devices" UI (data model ready)
- PARTIAL Session revocation on password change

## V4 Access Control

- YES RBAC via @Roles() + RolesGuard
- YES MFA gating for admin roles
- YES User isolation: controllers use req.user.sub only
- YES Admin actions audit-logged
- PARTIAL ABAC (fine-grained resource ownership) implicit

## V5 Validation

- YES class-validator on all DTOs
- YES Whitelist mode rejects unknown fields
- YES Prisma parameterized queries
- YES React escapes by default
- NO HTML sanitization on UGC (no UGC yet)

## V6 Cryptography

- YES Argon2id for passwords
- YES SHA-256 for seed hashes
- YES HMAC-SHA256 for RNG
- YES TOTP secrets stored per user
- YES Secrets read from env, no hardcoded values
- PARTIAL Secrets rotation policy in RUNBOOK
- NO Field-level encryption at rest (planned)

## V7 Error Handling & Logging

- YES Structured JSON logs with requestId
- YES No stack traces in responses
- YES SecurityEvent table for login/MFA/suspicious
- YES AuditLog for every admin mutation
- YES Log correlation via x-request-id

## V8 Data Protection

- YES TLS assumed at reverse proxy (dev uses http)
- YES Sensitive fields redacted in audit diff
- PARTIAL Retention policy not enforced (research scope)
- NO PII encryption at rest (planned)

## V9 Communications

- YES CORS whitelist
- YES HSTS in production
- YES Referrer-Policy: strict-origin-when-cross-origin
- YES WebSocket CORS enforced

## V10 Malicious Code

- YES No eval, no dynamic require of user input
- PARTIAL Dependency audit: pnpm audit recommended in CI
- NO Container image scanning in CI

## V11 Business Logic

- YES Server-authoritative RNG
- YES Anti-abuse riskyWager
- YES Idempotency via serializable transactions
- YES Balance cannot go negative
- PARTIAL Velocity checks (basic)
- NO Multi-account detection

## V12 Files & Resources

- PARTIAL File upload for KYC stub not implemented
- NO Antivirus scanning (n/a, no uploads yet)

## V13 API & Web Service

- YES REST
- YES Consistent error format
- PARTIAL WebSocket auth (planned)
- YES Rate limiting
- YES CORS

## V14 Configuration

- YES .env not committed; .env.example provided
- YES NODE_ENV differentiates dev/prod
- NO Secret manager in production
- NO Separate DB per environment

## V15+ (L3)

- NO Self-contained tokens with short TTL and rotation
- NO HSM-backed secrets
- NO Certificate pinning for mobile clients
