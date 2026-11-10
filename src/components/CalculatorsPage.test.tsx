// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ userId: 'calculator-user-1' }));
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ profile: { id: mocks.userId } }) }));

import { CalculatorsPage } from './CalculatorsPage';
import { CALCULATOR_IDS, CALCULATOR_LABELS, calculatorPreferenceKey, DEFAULT_CALCULATOR_VISIBILITY } from '../lib/calculatorPreferences';

let host: HTMLDivElement;
let root: Root;

function renderPage() { act(() => root.render(createElement(CalculatorsPage))); }
function openOrganizer() {
  const trigger = [...host.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Choose calculators');
  act(() => trigger?.click());
}
function toggle(label: string) {
  const option = [...host.querySelectorAll<HTMLLabelElement>('.calc-choice-option')].find((item) => item.textContent?.includes(label));
  const input = option?.querySelector('input');
  if (!input) throw new Error(`Missing calculator checkbox for ${label}`);
  act(() => input.click());
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  mocks.userId = 'calculator-user-1';
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('CalculatorsPage visibility preferences', () => {
  it('starts with no cards visible, offers calculators in order, persists choices, and can show all', () => {
    localStorage.setItem(`topset:calculator-visibility:v1:${mocks.userId}`, JSON.stringify(Object.fromEntries(CALCULATOR_IDS.map((id) => [id, true]))));
    renderPage();
    expect(host.querySelectorAll('.calc-grid > .calc-card')).toHaveLength(0);
    expect(host.textContent).toContain('0 of 6 calculators selected');
    expect(host.textContent).toContain('Choose calculators above to show them here.');
    expect(host.querySelector('.calc-organizer-panel')).toBeNull();

    openOrganizer();
    expect(host.querySelectorAll('.calc-choice-list input[type="checkbox"]')).toHaveLength(6);
    expect(host.querySelectorAll('.calc-choice-list input[type="checkbox"]:checked')).toHaveLength(0);
    expect([...host.querySelectorAll('.calc-choice-list li')].map((item) => item.textContent?.trim())).toEqual(CALCULATOR_IDS.map((id) => CALCULATOR_LABELS[id]));
    toggle('RPE load');
    expect(host.querySelectorAll('.calc-grid > .calc-card')).toHaveLength(1);
    expect([...host.querySelectorAll('.calc-card h2')].some((heading) => heading.textContent === 'RPE load')).toBe(true);
    expect(JSON.parse(localStorage.getItem(calculatorPreferenceKey(mocks.userId)) ?? '{}')['rpe-load']).toBe(true);
    toggle('Plate calculator');
    expect(host.querySelectorAll('.calc-grid > .calc-card')).toHaveLength(2);

    act(() => root.unmount());
    root = createRoot(host);
    renderPage();
    expect(host.querySelectorAll('.calc-grid > .calc-card')).toHaveLength(2);
    expect([...host.querySelectorAll('.calc-card h2')].some((heading) => heading.textContent === 'RPE load')).toBe(true);
    expect(host.querySelector('.calc-organizer-panel')).toBeNull();
    openOrganizer();

    const restore = [...host.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Show all calculators');
    act(() => restore?.click());
    expect(host.querySelectorAll('.calc-grid > .calc-card')).toHaveLength(6);
    expect(host.textContent).toContain('6 of 6 calculators selected');
    expect(CALCULATOR_IDS.every((id) => JSON.parse(localStorage.getItem(calculatorPreferenceKey(mocks.userId)) ?? '{}')[id] === true)).toBe(true);
    expect([...host.querySelectorAll('.calc-card h2')].map((heading) => heading.textContent)).toEqual(CALCULATOR_IDS.map((id) => CALCULATOR_LABELS[id]));
  });

  it("keeps one user's choices separate from another user", () => {
    renderPage();
    expect(host.querySelectorAll('.calc-grid > .calc-card')).toHaveLength(0);
    openOrganizer();
    toggle('Plate calculator');
    expect(host.querySelectorAll('.calc-grid > .calc-card')).toHaveLength(1);
    act(() => root.unmount());
    mocks.userId = 'calculator-user-2';
    root = createRoot(host);
    renderPage();
    expect(host.querySelectorAll('.calc-grid > .calc-card')).toHaveLength(0);
  });

  it('preserves a customized selection when migrating old preferences', () => {
    localStorage.setItem(`topset:calculator-visibility:v1:${mocks.userId}`, JSON.stringify({ ...DEFAULT_CALCULATOR_VISIBILITY, 'strength-scores': true }));
    renderPage();
    expect(host.querySelectorAll('.calc-grid > .calc-card')).toHaveLength(1);
    expect(host.querySelector('.calc-card h2')?.textContent).toBe('Strength scores');
  });
});
