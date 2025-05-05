'use server';

import { createClient } from '@/utils/supabase/server';

interface FormData {
  phone: string;
}

export async function createSubscription(data: FormData) {
  const response = await fetch('https://api.mercadopago.com/preapproval', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      reason: 'Pro Plan Subscription',
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: 12.9,
        currency_id: 'BRL',
        start_date: new Date().toISOString(),
        end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
      },
      back_url: 'https://yourdomain.com/subscription/return',
      payer_email: 'test_user@testuser.com',
      external_reference: '1234567890',
      card_token_id: '1234567890',
    }),
  });

  console.log(await response.json());
  // const init_point = (await response.json()).data.init_point
  // console.log(init_point)
  // return init_point
}
