import { useAuth } from '../../auth/AuthProvider';

export function useCoachId() {
  const { profile } = useAuth();
  return profile?.id ?? '';
}
