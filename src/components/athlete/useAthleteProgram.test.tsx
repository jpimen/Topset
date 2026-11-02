// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => {
  const channel = { on: vi.fn(), subscribe: vi.fn() };
  return { load: vi.fn(), channel, createChannel: vi.fn(), removeChannel: vi.fn(), event: undefined as (() => void) | undefined };
});
vi.mock('../../lib/athlete/programs', () => ({ loadActiveAthleteProgram: mocks.load }));
vi.mock('../../lib/supabase', () => ({ supabase: {
  channel: (...args: unknown[]) => { mocks.createChannel(...args); return mocks.channel; },
  removeChannel: mocks.removeChannel,
} }));
import { useAthleteProgram } from './useAthleteProgram';
let host: HTMLDivElement;
let root: Root;
function Probe({ dirty }: { dirty: boolean }) {
  const value = useAthleteProgram('athlete', dirty);
  return <div><button onClick={value.refresh}>Refresh</button>{value.refreshDeferred ? 'paused' : ''}{value.result ? 'program' : ''}{value.error}</div>;
}
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.load.mockReset().mockResolvedValue({ state: { assignment: { id: 'assignment', program_id: 'program', sync_mode: 'live' }, program: {} }, source: 'server', verifiedAt: 1, warning: '' });
  mocks.createChannel.mockReset();
  mocks.removeChannel.mockReset();
  mocks.event = undefined;
  mocks.channel.on.mockReset().mockImplementation((_type: unknown, _filter: unknown, callback: () => void) => { mocks.event = callback; return mocks.channel; });
  mocks.channel.subscribe.mockReset().mockReturnThis();
  host = document.createElement('div');
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); vi.restoreAllMocks(); });

it('defers manual and reconnect refresh until unsaved entries have been saved', async () => {
  await act(async () => root.render(<Probe dirty={false} />));
  await act(async () => root.render(<Probe dirty />));
  await act(async () => { host.querySelector('button')!.click(); window.dispatchEvent(new Event('online')); });
  expect(mocks.load).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain('paused');
  await act(async () => root.render(<Probe dirty={false} />));
  expect(mocks.load).toHaveBeenCalledTimes(2);
});

it('removes previous data on an authoritative empty revalidation', async () => {
  await act(async () => root.render(<Probe dirty={false} />));
  mocks.load.mockResolvedValue({ state: null, source: 'server', verifiedAt: 2, warning: '' });
  await act(async () => host.querySelector('button')!.click());
  expect(host.textContent).not.toContain('program');
});

it('revalidates live prescriptions when the saved program emits an update', async () => {
  await act(async () => root.render(<Probe dirty={false} />));
  expect(mocks.createChannel).toHaveBeenCalledWith('athlete-live-program:athlete:program');
  expect(mocks.event).toBeDefined();
  await act(async () => { mocks.event?.(); await new Promise((resolve) => setTimeout(resolve, 300)); });
  expect(mocks.load).toHaveBeenCalledTimes(2);
});
