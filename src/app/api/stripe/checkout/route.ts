import { createClient } from '@/utils/supabase/server';
import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const { priceId, nickname } = await request.json();

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) {
    return Response.json({ error: error.message }, { status: 401 });
  }

  // Update the user's nickname
  await prisma.users.update({
    where: { id: user?.id },
    data: { nickname },
  });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
  const session = await stripe.checkout.sessions.create({
    client_reference_id: user?.id,
    billing_address_collection: 'auto',
    line_items: [
      {
        price: priceId,
        // For metered billing, do not pass quantity
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: 30,
      trial_settings: {
        end_behavior: {
          missing_payment_method: 'cancel',
        },
      },
    },
    mode: 'subscription',
    success_url: `${process.env.NEXT_PUBLIC_URL}/api/stripe/success?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/api/stripe/cancel?canceled=true`,
    locale: 'pt-BR',
  });

  return Response.json({ session });
}
