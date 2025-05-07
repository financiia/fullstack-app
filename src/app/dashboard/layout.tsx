import { createContext, ReactNode, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/layout/dashboard-layout';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { getUserData } from '@/lib/supabase-utils';
import { UserProvider } from './user-context';

interface Props {
  children: ReactNode;
}

export default async function Layout({ children }: Props) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect('/signup');
  }
  const user = await getUserData();
  return (
    <UserProvider user={user}>
      <DashboardLayout>{children}</DashboardLayout>
    </UserProvider>
  );
}
