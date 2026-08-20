import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { profileApi, type ProfileUpdate } from '../services/api/endpoints';
import { useAuth } from '../store/auth';
import type { MyProfile } from '../types';

export const PROFILE_KEY = ['profile', 'me'] as const;

/** The signed-in user's own profile. Disabled until there's a session to fetch it with. */
export function useMyProfile() {
  const user = useAuth((s) => s.user);

  return useQuery({
    queryKey: PROFILE_KEY,
    queryFn: profileApi.me,
    enabled: Boolean(user),
    staleTime: 30_000,
  });
}

/** Writes the profile and seeds the cache with the response, so no refetch is needed after saving. */
export function useUpdateProfile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: ProfileUpdate) => profileApi.update(body),
    onSuccess: (data) => qc.setQueryData(PROFILE_KEY, data),
  });
}

export function useUpsertCompany() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: { name: string; logoUrl?: string; industry?: string }) =>
      profileApi.upsertCompany(body),
    // The company is nested inside the profile payload, so refetch rather than patch it in by hand.
    onSuccess: () => qc.invalidateQueries({ queryKey: PROFILE_KEY }),
  });
}

/**
 * Whether this account has finished onboarding, and can therefore be dropped into the tabs.
 *
 * The rule differs by role because the two flows collect different things, and each stops at the
 * point where the rest of the product becomes usable:
 *
 *  - a candidate needs a name and at least one skill, since an empty skill list means every match
 *    score would be zero and the deck would be meaningless
 *  - a recruiter needs a name and a company, since a job can't be posted without one
 *
 * Derived from the profile rather than stored as a flag, so it can't drift out of step with what
 * is actually filled in — including if the user clears something later.
 */
export function isSetupComplete(profile: MyProfile | undefined): boolean {
  if (!profile?.profile?.fullName) return false;

  if (profile.role === 'candidate') {
    return (profile.candidate?.skills?.length ?? 0) > 0;
  }

  return Boolean(profile.company);
}
