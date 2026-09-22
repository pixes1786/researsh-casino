const BASE = ''; // all requests go through Next.js /api/* rewrite → same-origin, cookies work

/**
 * Paths that must NEVER trigger a silent device-login retry
 * (either they're the auth flow itself, or they'd cause loops).
 */
const NO_RETRY_PREFIXES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/device-login',
  '/api/auth/logout',
  '/api/auth/2fa',
];

let deviceLoginPromise: Promise<boolean> | null = null;

/** Single-flight device-login attempt (dedupes parallel 401s). */
async function tryDeviceLogin(): Promise<boolean> {
  if (!deviceLoginPromise) {
    deviceLoginPromise = fetch(`${BASE}/auth/device-login`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (r) => {
        if (!r.ok) return false;
        const j = await r.json().catch(() => ({}));
        return !!j?.ok;
      })
      .catch(() => false)
      .finally(() => {
        // release the gate after a short delay so concurrent requests share it
        setTimeout(() => { deviceLoginPromise = null; }, 50);
      });
  }
  return deviceLoginPromise;
}

async function req<T>(path: string, init: RequestInit = {}, allowRetry = true): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });

  const noRetry = NO_RETRY_PREFIXES.some((p) => path.startsWith(p));

  if (res.status === 401 && allowRetry && !noRetry) {
    const ok = await tryDeviceLogin();
    if (ok) {
      // retry once with the fresh cookies
      return req<T>(path, init, false);
    }
  }

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  me: () => req<any>('/api/auth/me'),
  register: (b: any) => req('/api/auth/register', { method: 'POST', body: JSON.stringify(b) }),
  login: (b: any) => req('/api/auth/login', { method: 'POST', body: JSON.stringify(b) }),
  logout: () => req('/api/auth/logout', { method: 'POST' }),
  deviceLogin: () => req<{ ok: boolean }>('/api/auth/device-login', { method: 'POST' }),
  listDevices: () => req<any[]>('/api/auth/devices'),
  revokeDevice: (id: string) => req(`/api/auth/devices/${id}`, { method: 'DELETE' }),
  revokeAllDevices: () => req('/api/auth/devices/revoke-all', { method: 'POST' }),

  mfaStatus: () => req<any>('/api/auth/2fa/status'),
  mfaSetup: () => req<any>('/api/auth/2fa/setup', { method: 'POST' }),
  mfaEnable: (code: string) => req<any>('/api/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) }),
  mfaDisable: (code: string) => req<any>('/api/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ code }) }),

  profile: () => req<any>('/api/me/profile'),
  myBets: (limit = 50) => req<any[]>(`/api/me/bets?limit=${limit}`),
  myRounds: (limit = 30) => req<any[]>(`/api/me/rounds?limit=${limit}`),
  mySessions: () => req<any[]>('/api/me/sessions'),

  games: (q = '') => req<any[]>(`/api/games${q}`),
  game: (slug: string) => req<any>(`/api/games/${slug}`),
  liveFeed: () => req<any[]>('/api/games/live-feed'),

  wallet: () => req<{ currency: string; balance: number }>('/api/wallet'),
  ledger: () => req<any[]>('/api/wallet/ledger'),

  rouletteSeed: () => req<any>('/api/games/roulette/seed'),
  rouletteSetClient: (clientSeed: string) =>
    req('/api/games/roulette/seed/client', { method: 'POST', body: JSON.stringify({ clientSeed }) }),
  rouletteRotate: () => req<any>('/api/games/roulette/seed/rotate', { method: 'POST' }),
  rouletteBet: (bets: { bet: any; amount: number }[]) =>
    req<any>('/api/games/roulette/bet', { method: 'POST', body: JSON.stringify({ bets }) }),
  rouletteVerify: (roundId: string) => req<any>(`/api/games/roulette/verify/${roundId}`),

  diceSeed: () => req<any>('/api/games/dice/seed'),
  diceSetClient: (clientSeed: string) =>
    req('/api/games/dice/seed/client', { method: 'POST', body: JSON.stringify({ clientSeed }) }),
  diceRotate: () => req<any>('/api/games/dice/seed/rotate', { method: 'POST' }),
  diceBet: (b: { target: number; direction: 'under' | 'over'; amount: number }) =>
    req<any>('/api/games/dice/bet', { method: 'POST', body: JSON.stringify(b) }),
  diceVerify: (roundId: string) => req<any>(`/api/games/dice/verify/${roundId}`),

  crashStart: (bet: number) =>
    req<any>('/api/games/crash/start', { method: 'POST', body: JSON.stringify({ bet }) }),
  crashCashout: (roundId: string) =>
    req<any>('/api/games/crash/cashout', { method: 'POST', body: JSON.stringify({ roundId }) }),
  crashOut: (roundId: string) =>
    req<any>('/api/games/crash/crash-out', { method: 'POST', body: JSON.stringify({ roundId }) }),
  crashState: () => req<any>('/api/games/crash/state'),
  crashHistory: () => req<any[]>('/api/games/crash/history'),

  slotsPaytable: () => req<any>('/api/games/slots/paytable'),
  slotsSeed: () => req<any>('/api/games/slots/seed'),
  slotsSetClient: (clientSeed: string) =>
    req('/api/games/slots/seed/client', { method: 'POST', body: JSON.stringify({ clientSeed }) }),
  slotsRotate: () => req<any>('/api/games/slots/seed/rotate', { method: 'POST' }),
  slotsSpin: (bet: number) =>
    req<any>('/api/games/slots/spin', { method: 'POST', body: JSON.stringify({ bet }) }),
  slotsVerify: (roundId: string) => req<any>(`/api/games/slots/verify/${roundId}`),

  blackjackStart: (bet: number) =>
    req<any>('/api/games/blackjack/start', { method: 'POST', body: JSON.stringify({ bet }) }),
  blackjackAction: (gameId: string, action: 'hit' | 'stand' | 'double' | 'split') =>
    req<any>('/api/games/blackjack/action', { method: 'POST', body: JSON.stringify({ gameId, action }) }),
  blackjackCurrent: () => req<any>('/api/games/blackjack/current'),
  blackjackHistory: () => req<any[]>('/api/games/blackjack/history'),

  minesStart: (bet: number, minesCount: number) =>
    req<any>('/api/games/mines/start', { method: 'POST', body: JSON.stringify({ bet, minesCount }) }),
  minesReveal: (gameId: string, position: number) =>
    req<any>('/api/games/mines/reveal', { method: 'POST', body: JSON.stringify({ gameId, position }) }),
  minesCashout: (gameId: string) =>
    req<any>('/api/games/mines/cashout', { method: 'POST', body: JSON.stringify({ gameId }) }),
  minesCurrent: () => req<any>('/api/games/mines/current'),
  minesHistory: () => req<any[]>('/api/games/mines/history'),
  minesPaytable: (mines: number) => req<any>(`/api/games/mines/paytable/${mines}`),

  gatesSpin: (bet: number) =>
    req<any>('/api/games/gates/spin', { method: 'POST', body: JSON.stringify({ bet }) }),
  gatesHistory: () => req<any[]>('/api/games/gates/history'),

  promoDaily: () => req<any>('/api/promo/daily'),
  promoClaimDaily: () => req<any>('/api/promo/daily/claim', { method: 'POST' }),
  promoMissions: () => req<any[]>('/api/promo/missions'),
  promoClaimMission: (id: string) => req<any>(`/api/promo/missions/${id}/claim`, { method: 'POST' }),
  promoTournament: () => req<any>('/api/promo/tournament'),
  promoVip: () => req<any>('/api/promo/vip'),

  adminDashboard: () => req<any>('/api/admin/dashboard'),
  adminUsers: (params: { search?: string; role?: string; status?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.role) q.set('role', params.role);
    if (params.status) q.set('status', params.status);
    const qs = q.toString();
    return req<any[]>(`/api/admin/users${qs ? `?${qs}` : ''}`);
  },
  adminUser: (id: string) => req<any>(`/api/admin/users/${id}`),
  adminUpdateUser: (id: string, patch: any) =>
    req(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  adminAdjustBalance: (id: string, delta: number, reason: string) =>
    req(`/api/admin/users/${id}/balance`, { method: 'POST', body: JSON.stringify({ delta, reason }) }),
  adminGames: () => req<any[]>('/api/admin/games'),
  adminUpdateGame: (id: string, patch: any) =>
    req(`/api/admin/games/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  adminLedger: (type?: string) => req<any[]>(`/api/admin/ledger${type ? `?type=${type}` : ''}`),
  adminAudit: () => req<any[]>('/api/admin/audit'),
  adminSecurity: (params: { kind?: string; severity?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.kind) q.set('kind', params.kind);
    if (params.severity) q.set('severity', params.severity);
    const qs = q.toString();
    return req<any[]>(`/api/admin/security${qs ? `?${qs}` : ''}`);
  },
  adminSecuritySummary: () => req<any>('/api/admin/security/summary'),
};
