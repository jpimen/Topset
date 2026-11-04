// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ read: vi.fn(), capabilities: vi.fn(), listener: vi.fn(), clear: vi.fn(() => '') }));
vi.mock('../lib/athlete/programs', () => ({ clearAthleteProgramCaches: mocks.clear }));
vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (table: string) => ({
      select: () => ({ eq: () => table === 'profiles' ? { maybeSingle: mocks.read } : Promise.resolve(mocks.capabilities()),
      }),
    }),
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: (callback: unknown) => { mocks.listener(callback); return { data: { subscription: { unsubscribe: vi.fn() } } }; },
    },
  },
}));
import { AuthProvider, useAuth } from './AuthProvider';
let host: HTMLDivElement;
let root: Root;
function Probe() {
  const { session, profile, loading } = useAuth();
  return <div>{loading ? 'loading' : `${session?.user.id ?? 'none'}:${profile?.id ?? 'none'}`}</div>;
}
const session = (id: string) => ({ user: { id } }) as Session;
const change = async (id: string | null) => {
  await act(async () => {
    mocks.listener.mock.calls[0][0]('SIGNED_IN', id ? session(id) : null);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};
beforeEach(async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  mocks.capabilities.mockReturnValue({ data: [{ capability: 'athlete' }], error: null });
  host = document.createElement('div');
  root = createRoot(host);
  await act(async () => root.render(<AuthProvider><Probe /></AuthProvider>));
});
afterEach(() => { act(() => root.unmount()); vi.restoreAllMocks(); });

it('hides the previous profile as soon as the account changes', async () => {
  mocks.read.mockResolvedValueOnce({ data: { id: 'A', role: 'athlete' }, error: null });
  await change('A');
  expect(host.textContent).toBe('A:A');
  mocks.read.mockReturnValueOnce(new Promise(() => undefined));
  await change('B');
  expect(host.textContent).toBe('loading');
  expect(mocks.clear).toHaveBeenCalled();
});

it('ignores profile reads that finish after sign-out or another account', async () => {
  let finish!: (value: unknown) => void;
  mocks.read.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  await change('A');
  await change(null);
  await act(async () => finish({ data: { id: 'A', role: 'athlete' }, error: null }));
  expect(host.textContent).toBe('none:none');
});

it('retains a verified same-user profile on token refresh without clearing data', async () => {
  mocks.read.mockResolvedValue({ data: { id: 'A', role: 'athlete' }, error: null });
  await change('A');
  mocks.clear.mockClear();
  await change('A');
  expect(host.textContent).toBe('A:A');
  expect(mocks.read).toHaveBeenCalledTimes(1);
  expect(mocks.clear).not.toHaveBeenCalled();
});
