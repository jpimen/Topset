// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditableGridCell } from './EditableGridCell';

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('EditableGridCell keyboard editing', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.restoreAllMocks();
  });

  it('moves with arrows, opens on Enter, commits with Enter, and cancels with Escape', async () => {
    const commit = vi.fn();
    const render = () => <div role="grid"><div role="row"><EditableGridCell row={1} column={0} label="Reps" value="5" onCommit={commit} /><EditableGridCell row={1} column={1} label="Sets" value="3" onCommit={() => undefined} /></div><div role="row"><EditableGridCell row={2} column={0} label="Next reps" value="3" onCommit={() => undefined} /></div></div>;
    act(() => root.render(render()));

    const firstButton = host.querySelector<HTMLButtonElement>('[data-grid-cell="1:0"] button')!;
    act(() => { firstButton.focus(); firstButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); });
    expect(document.activeElement).toBe(host.querySelector('[data-grid-cell="2:0"] button'));
    act(() => { (document.activeElement as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Next reps"]')).not.toBeNull();

    const repsButton = host.querySelector<HTMLButtonElement>('[data-grid-cell="1:0"] button')!;
    act(() => repsButton.click());
    let input = host.querySelector<HTMLInputElement>('input[aria-label="Reps"]')!;
    act(() => setInputValue(input, '12'));
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(commit).not.toHaveBeenCalled();
    expect(host.querySelector('[data-grid-cell="1:0"] button')?.textContent).toBe('5');

    act(() => (host.querySelector('[data-grid-cell="1:0"] button') as HTMLButtonElement).click());
    input = host.querySelector<HTMLInputElement>('input[aria-label="Reps"]')!;
    act(() => setInputValue(input, '4'));
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(commit).toHaveBeenCalledWith('4');

    act(() => (host.querySelector('[data-grid-cell="1:0"] button') as HTMLButtonElement).click());
    input = host.querySelector<HTMLInputElement>('input[aria-label="Reps"]')!;
    act(() => setInputValue(input, '2'));
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })));
    await act(async () => { await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve())); });
    expect(commit).toHaveBeenCalledWith('2');
    expect(document.activeElement).toBe(host.querySelector('[data-grid-cell="1:1"] button'));
  });
});
