// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IPFRulebookPage } from './IPFRulebookPage';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('IPFRulebookPage', () => {
  it('shows the edition, governing PDF link and section navigation', () => {
    act(() => root.render(createElement(IPFRulebookPage)));
    expect(host.textContent).toContain('Effective 1 March 2026');
    expect(host.textContent).toContain('Official source governs');
    expect(host.querySelector('a[href*="2026_IPF_Technical_Rulebook__effective"]')).not.toBeNull();
    expect(host.querySelector('nav[aria-label="Rulebook section navigation"] a[href="#rulebook-section-10"]')).not.toBeNull();
    expect(host.textContent).toContain('PDF p. 44');
    expect(host.textContent).toContain('not part of the Technical Rulebook');
  });

  it('filters summaries and reports an empty search state', () => {
    act(() => root.render(createElement(IPFRulebookPage)));
    const input = host.querySelector('input[type="search"]');
    expect(input).not.toBeNull();
    act(() => {
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'weighing');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(host.textContent).toContain('Weighing In');
    expect(host.textContent).not.toContain('Squat setup');

    act(() => {
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'no such rule');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(host.textContent).toContain('No rule summaries match');
  });

  it('opens official records, switches sources and can reload the current source', () => {
    act(() => root.render(createElement(IPFRulebookPage)));
    const recordsToggle = [...host.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Records');
    expect(recordsToggle).not.toBeUndefined();

    act(() => recordsToggle?.click());
    expect(recordsToggle?.getAttribute('aria-expanded')).toBe('true');
    expect(host.textContent).toContain('Philippine Classic / Raw National Records');
    expect(host.textContent).toContain('does not show a last-updated date');
    expect(host.querySelector('iframe[title="Philippine Classic / Raw National Records"]')).not.toBeNull();

    const asianRecordsTab = [...host.querySelectorAll<HTMLButtonElement>('nav[aria-label="Record categories"] button')]
      .find((button) => button.textContent?.trim() === 'Asian · Classic');
    act(() => asianRecordsTab?.click());
    expect(host.textContent).toContain('updated 15 January 2024');
    expect([...host.querySelectorAll('iframe')].some((frame) => frame.title === 'Asian Classic Powerlifting & Bench Press Records')).toBe(true);

    const worldRecordsTab = [...host.querySelectorAll<HTMLButtonElement>('nav[aria-label="Record categories"] button')]
      .find((button) => button.textContent?.trim() === 'World');
    act(() => worldRecordsTab?.click());
    expect(host.textContent).toContain('21 September 2026');
    const previousFrame = [...host.querySelectorAll('iframe')].find((frame) => frame.title === 'IPF World Records');
    expect(previousFrame).not.toBeNull();
    const previousFrameSource = previousFrame?.getAttribute('src');
    const refreshButton = [...host.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Refresh records');
    act(() => refreshButton?.click());
    const refreshedFrame = [...host.querySelectorAll('iframe')].find((frame) => frame.title === 'IPF World Records');
    expect(refreshedFrame).not.toBe(previousFrame);
    expect(refreshedFrame?.getAttribute('src')).not.toBe(previousFrameSource);
  });
});
