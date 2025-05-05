import { NextResponse, NextRequest } from 'next/server';
import Stripe from 'stripe';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server-internal';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  console.log(user);
  if (error) {
    return Response.json({ error: error.message }, { status: 401 });
  }

  // Get stripe customer id
  const user_data = await prisma.users.findUnique({
    where: {
      id: user?.id,
    },
  });

  const stripe_customer_id = user_data?.stripe_customer_id;
  if (!stripe_customer_id) {
    return Response.json({ error: 'Stripe customer ID not found' }, { status: 404 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
  const invoices = await stripe.invoices.list({
    customer: stripe_customer_id,
  });

  const subscriptions = await stripe.subscriptions.list({
    customer: stripe_customer_id,
  });
  console.log(subscriptions);

  return NextResponse.json({ invoices, subscriptions }, { status: 200 });
}
