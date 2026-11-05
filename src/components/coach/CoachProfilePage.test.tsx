// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
  createSignedUrl: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('../../auth/AuthProvider', () => ({ useAuth: mocks.useAuth }));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ update: mocks.update }),
    storage: { from: () => ({ createSignedUrl: mocks.createSignedUrl, upload: mocks.upload, remove: mocks.remove }) },
  },
}));

import { CoachProfilePage } from './CoachProfilePage';

const coachProfile = {
  id: 'coach-id', role: 'coach' as const, name: 'Coach One', team_name: 'Topset Club', weight_class: null,
  bio: 'Coaching with intent.', category: 'Powerlifting', achievements: 'National coach', profile_photo_path: null,
};
let host: HTMLDivElement;
let root: Root;
let authContext: {
  profile: typeof coachProfile | null;
  session: { user: { email: string } };
  loading: boolean;
  profileError: null;
  refreshProfile: ReturnType<typeof vi.fn>;
};

async function renderPage() {
  await act(async () => root.render(createElement(CoachProfilePage)));
}

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  authContext = {
    profile: coachProfile,
    session: { user: { email: 'coach@example.com' } },
    loading: false,
    profileError: null,
    refreshProfile: vi.fn().mockImplementation(async () => {
      const update = mocks.update.mock.calls[0]?.[0] as Partial<typeof coachProfile> | undefined;
      authContext.profile = { ...coachProfile, ...update };
    }),
  };
  mocks.useAuth.mockImplementation(() => authContext);
  mocks.update.mockImplementation(() => ({ eq: mocks.eq }));
  mocks.eq.mockImplementation(() => ({ select: mocks.select }));
  mocks.select.mockImplementation(() => ({ maybeSingle: mocks.maybeSingle }));
  mocks.maybeSingle.mockResolvedValue({ data: { id: coachProfile.id }, error: null });
  mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://example.test/profile.jpg' }, error: null });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.clearAllMocks();
});

describe('CoachProfilePage', () => {
  it('shows the signed-in Coach details and keeps email read-only', async () => {
    await renderPage();
    expect(host.textContent).toContain('Coach One');
    expect(host.textContent).toContain('coach@example.com');
    expect(host.textContent).toContain('Topset Club');
    expect(host.textContent).toContain('Powerlifting');
    expect(host.textContent).toContain('Coaching with intent.');
    expect(host.textContent).toContain('National coach');
    expect(host.querySelector('input[type="email"]')).toBeNull();
    expect(host.querySelector('button')?.textContent).toContain('Edit profile');
  });

  it('discards unsaved values when Cancel is selected', async () => {
    await renderPage();
    const editButton = [...host.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Edit profile');
    act(() => editButton?.click());
    const nameInput = host.querySelector<HTMLInputElement>('input[autocomplete="name"]');
    expect(nameInput).not.toBeNull();
    act(() => { if (nameInput) setInputValue(nameInput, 'Changed Name'); });
    const cancelButton = [...host.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Cancel');
    act(() => cancelButton?.click());
    expect(host.textContent).toContain('Coach One');
    expect(host.textContent).not.toContain('Changed Name');
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('saves editable fields for the signed-in profile and returns to read-only view', async () => {
    await renderPage();
    const editButton = [...host.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Edit profile');
    act(() => editButton?.click());
    const nameInput = host.querySelector<HTMLInputElement>('input[autocomplete="name"]');
    expect(nameInput).not.toBeNull();
    act(() => { if (nameInput) setInputValue(nameInput, 'Coach Updated'); });
    const form = host.querySelector('form');
    expect(form).not.toBeNull();
    await act(async () => form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(mocks.update).toHaveBeenCalledWith({
      name: 'Coach Updated', team_name: 'Topset Club', bio: 'Coaching with intent.', category: 'Powerlifting', achievements: 'National coach',
    });
    expect(mocks.eq).toHaveBeenCalledWith('id', 'coach-id');
    expect(host.textContent).toContain('Coach Updated');
    expect(host.textContent).toContain('Profile saved.');
    expect(host.textContent).not.toContain('Save profile');
  });
});
