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
});
