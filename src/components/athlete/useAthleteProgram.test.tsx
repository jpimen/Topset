// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('../../lib/athlete/programs', () => ({ loadActiveAthleteProgram: mocks.load }));
import { useAthleteProgram } from './useAthleteProgram';
let host: HTMLDivElement;
let root: Root;
function Probe({ dirty }: { dirty: boolean }) {
  const value = useAthleteProgram('athlete', dirty);
  return <div><button onClick={value.refresh}>Refresh</button>{value.refreshDeferred ? 'paused' : ''}{value.result ? 'program' : ''}{value.error}</div>;
}
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.load.mockReset().mockResolvedValue({ state: { assignment: {}, program: {} }, source: 'server', verifiedAt: 1, warning: '' });
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
