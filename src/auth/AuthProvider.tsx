import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { clearAthleteProgramCaches } from '../lib/athlete/programs';

export type Role = 'coach' | 'athlete';

export interface UserProfile {
  id: string;
  role: Role;
  capabilities: Role[];
  name: string;
  team_name: string | null;
  weight_class: string | null;
  bio: string | null;
  category: string | null;
  achievements: string | null;
  profile_photo_path: string | null;
}

interface AuthContextValue {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  profileError: string | null;
  configured: boolean;
  storageWarning: string;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function readProfile(userId: string): Promise<UserProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, name, team_name, weight_class, bio, category, achievements, profile_photo_path')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: capabilityRows, error: capabilityError } = await supabase
    .from('profile_capabilities')
    .select('capability')
    .eq('profile_id', userId);
  if (capabilityError) throw capabilityError;
  const capabilities = (capabilityRows ?? []).map((row) => row.capability).filter((value): value is Role => value === 'coach' || value === 'athlete');
  if (!capabilities.includes(data.role as Role)) throw new Error('Account capability is missing its signup role.');
  return { ...data, capabilities } as UserProfile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState('');
  const identity = useRef<string | null | undefined>(undefined);
  const verifiedProfile = useRef<UserProfile | null>(null);
  const revision = useRef(0);
  const mounted = useRef(false);

  const refreshProfile = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId || identity.current !== userId) return;
    const request = ++revision.current;
    try {
      setProfileError(null);
      const next = await readProfile(userId);
      if (!mounted.current || revision.current !== request || identity.current !== userId) return;
      if (next?.capabilities.includes('athlete') !== verifiedProfile.current?.capabilities.includes('athlete')) setStorageWarning(clearAthleteProgramCaches());
      verifiedProfile.current = next;
      setProfile(next);
    } catch (cause) {
      console.error('Account profile could not be refreshed.', cause);
      if (mounted.current && revision.current === request) {
        verifiedProfile.current = null;
        setProfile(null);
        setProfileError('We could not load your account profile. Please try again.');
      }
    }
  }, [session?.user.id]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    mounted.current = true;
    let receivedAuthEvent = false;
    const applySession = (nextSession: Session | null) => {
      if (!mounted.current) return;
      const nextId = nextSession?.user.id ?? null;
      const restoredIdentity = identity.current === undefined;
      const changed = identity.current !== nextId;
      if (changed) {
        const needsCleanup = identity.current !== undefined || nextId === null;
        identity.current = nextId;
        verifiedProfile.current = null;
        setProfile(null);
        if (needsCleanup) setStorageWarning(clearAthleteProgramCaches());
      }
      setSession(nextSession);
      if (!nextSession) {
        revision.current += 1;
        setProfile(null);
        setProfileError(null);
        setLoading(false);
        return;
      }
      if (!changed && verifiedProfile.current?.id === nextId) return;
      const request = ++revision.current;
      setLoading(true);
      setProfileError(null);
      // Supabase auth callbacks remain synchronous; profile I/O runs outside the auth lock.
      window.setTimeout(() => void (async () => {
      if (!mounted.current || request !== revision.current) return;
      try {
        setProfileError(null);
        const nextProfile = await readProfile(nextSession.user.id);
        if (mounted.current && request === revision.current && identity.current === nextId) {
          if (restoredIdentity) setStorageWarning(clearAthleteProgramCaches(nextProfile?.capabilities.includes('athlete') ? nextProfile.id : undefined));
          verifiedProfile.current = nextProfile;
          setProfile(nextProfile);
        }
      } catch (cause) {
        console.error('Account profile could not be loaded.', cause);
        if (mounted.current && request === revision.current) {
          setProfile(null);
          setProfileError('We could not load your account profile. Please try again.');
        }
      } finally {
        if (mounted.current && request === revision.current) setLoading(false);
      }
      })(), 0);
    };

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      receivedAuthEvent = true;
      applySession(nextSession);
    });
    void supabase.auth.getSession().then(({ data }) => { if (!receivedAuthEvent) applySession(data.session); });

    return () => {
      mounted.current = false;
      revision.current += 1;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ session, profile, loading, profileError, storageWarning, configured: isSupabaseConfigured, refreshProfile }),
    [session, profile, loading, profileError, storageWarning, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
