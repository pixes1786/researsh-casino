import { create } from 'zustand';

type S = {
  user: any | null;
  balance: number;
  currency: string;
  setUser: (u: any) => void;
  setBalance: (b: number) => void;
};

export const useSession = create<S>((set) => ({
  user: null,
  balance: 0,
  currency: 'RC',
  setUser: (u) => set({ user: u, balance: u?.balance ?? 0, currency: u?.currency ?? 'RC' }),
  setBalance: (b) => set({ balance: b }),
}));
