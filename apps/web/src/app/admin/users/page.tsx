'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';

const ROLES = ['', 'USER', 'MODERATOR', 'SUPPORT', 'RISK', 'ADMIN', 'SUPERADMIN'];
const STATUSES = ['', 'ACTIVE', 'SUSPENDED', 'SELF_EXCLUDED'];

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');

  const q = useQuery({
    queryKey: ['adminUsers', search, role, status],
    queryFn: () => api.adminUsers({ search, role, status }),
    refetchInterval: 20_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
        <div className="text-xs text-gray-500">{(q.data ?? []).length} shown</div>
      </div>

      <div className="rounded-2xl border border-border bg-panel p-3 flex flex-wrap gap-2">
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search email or username…"
          className="flex-1 min-w-[220px] bg-bg border border-border rounded px-3 py-2 text-sm"
        />
        <select value={role} onChange={(e) => setRole(e.target.value)}
          className="bg-bg border border-border rounded px-3 py-2 text-sm">
          {ROLES.map((r) => <option key={r} value={r}>{r || 'All roles'}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="bg-bg border border-border rounded px-3 py-2 text-sm">
          {STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </select>
      </div>

      <div className="rounded-2xl border border-border bg-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/30 text-[11px] uppercase tracking-widest text-gray-500">
              <tr>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-3">Role</th>
                <th className="text-left px-3">Status</th>
                <th className="text-left px-3">KYC</th>
                <th className="text-right px-3">Balance</th>
                <th className="text-right px-3">VIP</th>
                <th className="text-right px-3">Created</th>
                <th className="px-3"></th>
              </tr>
            </thead>
            <tbody>
              {(q.data ?? []).map((u: any) => (
                <tr key={u.id} className="border-t border-border/40 hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold">{u.username}</div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </td>
                  <td className="px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      u.role === 'ADMIN' || u.role === 'SUPERADMIN' ? 'bg-gold text-black'
                        : u.role === 'RISK' ? 'bg-danger/20 text-danger'
                        : 'bg-white/10'
                    }`}>{u.role}</span>
                  </td>
                  <td className="px-3">
                    <span className={`text-xs ${u.status === 'ACTIVE' ? 'text-success' : 'text-danger'}`}>
                      ● {u.status}
                    </span>
                  </td>
                  <td className="px-3 text-xs text-gray-400">{u.kycStatus}</td>
                  <td className="px-3 text-right font-mono">{u.balance.toFixed(2)} {u.currency}</td>
                  <td className="px-3 text-right">{u.vipLevel}</td>
                  <td className="px-3 text-right text-xs text-gray-500">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 text-right">
                    <Link href={`/admin/users/${u.id}`} className="text-accent hover:underline text-xs">
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
              {!q.data?.length && (
                <tr><td colSpan={8} className="py-8 text-center text-gray-500 text-xs">No users</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
