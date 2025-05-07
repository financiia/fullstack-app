'use client';

import { createContext, ReactNode } from 'react';
import { getUserData } from '@/lib/supabase-utils';

// Create a context for the whole app with the user data
export const UserContext = createContext<Awaited<ReturnType<typeof getUserData>> | null>(null);

export function UserProvider({
  children,
  user,
}: {
  children: ReactNode;
  user: Awaited<ReturnType<typeof getUserData>>;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}
