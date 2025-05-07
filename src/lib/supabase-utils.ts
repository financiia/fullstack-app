import prisma from './prisma';
import { createClient } from '@/utils/supabase/server';

export async function getUserData() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = await prisma.users.findUnique({
    where: {
      id: data.user?.id,
    },
  });
  return user;
}
