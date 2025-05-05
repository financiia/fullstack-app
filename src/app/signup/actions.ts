'use client';

import { createClient } from '@/utils/supabase/client';

interface FormData {
  phone: string;
}

export async function signup(data: FormData) {
  const response = await fetch('/api/generate-magic-link', {
    method: 'POST',
    body: JSON.stringify({ phone: data.phone }),
  });
  const { error } = await response.json();

  if (error) {
    console.log('Error: ', error);
    return { error: true };
  }

  // revalidatePath('/', 'layout');
  // redirect('/');
}

export async function verify(data: { phone: string; otp: string }) {
  const supabase = await createClient();
  console.log('Verifying OTP: ', data.otp);
  const {
    data: { user },
    error,
  } = await supabase.auth.verifyOtp({
    email: data.phone + '@supabase.io',
    token: data.otp,
    type: 'email',
  });

  // Manda pra o servidor verificar se é o primeiro registro do usuário. Se sim, manda uma mensagem de boas-vindas.
  if (!user?.phone_confirmed_at) {
    // await fetch('/api/send-welcome-message', {
    //   method: 'POST',
    //   body: JSON.stringify({ userId: user?.id! }),
    // });

    return { isFirstLogin: true };
  }

  if (error) {
    return { error: true };
  }

  if (user) {
    return { error: false };
  }
}
