'use client';

import { createClient } from '@/utils/supabase/client';
// Simples NEXTjs page para verificar o link do magic link do Supabase e redirecionar para a home
import { redirect } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Verify() {
  const [error, setError] = useState<string | null>(null);
  // Supabase sends token separating with #access_token=...
  // So we need to split the url and get the token from the access_token parameter
  useEffect(() => {
    const supabase = createClient();
    const searchParams = new URLSearchParams(window.location.href.split('#')[1]);
    const token = searchParams.get('access_token');

    if (token) {
      supabase.auth.setSession({
        access_token: searchParams.get('access_token') || '',
        refresh_token: searchParams.get('refresh_token') || '',
      });
      redirect('/');
    } else {
      setError('No token');
    }
  }, []);

  if (error) {
    return <div>Error: {error}</div>;
  }

  return <div>Verifying...</div>;
}
