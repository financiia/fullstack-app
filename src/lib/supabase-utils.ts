import { createClient } from '@/utils/supabase/server';

export async function getUserData() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return null;
  }

  const { data: user_data } = await supabase.from('users').select().eq('id', data.user?.id).single();
  return user_data;
}
