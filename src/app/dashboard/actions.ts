import Stripe from 'stripe';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server-internal';

export async function invoices() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  console.log(user);
  if (error) {
    return { error: error.message };
  }

  // Get stripe customer id
  const user_data = await prisma.users.findUnique({
    where: {
      id: user?.id,
    },
  });

  const stripe_customer_id = user_data?.stripe_customer_id;
  if (!stripe_customer_id) {
    return { error: 'Stripe customer ID not found' };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
  const invoices = await stripe.invoices.list({
    customer: stripe_customer_id,
  });

  const subscriptions = await stripe.subscriptions.list({
    customer: stripe_customer_id,
  });
  console.log(subscriptions);

  return { invoices: invoices.data, subscriptions: subscriptions.data };
}

export async function createUserPortal() {
  // Confirm it is the same user
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) {
    return { error: error.message };
  }
  if (!user) {
    return { error: 'User not found' };
  }

  // Get the customer id from the user
  const customer = await prisma.users.findUnique({
    where: {
      id: user.id,
    },
  });
  if (!customer) {
    return { error: 'Customer not found' };
  }
  if (!customer.stripe_customer_id) {
    return { error: 'Customer not found' };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
  const session = await stripe.billingPortal.sessions
    .create({
      customer: customer.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_URL}/dashboard/billing`,
      locale: 'pt-BR',
    })
    .then((session) => {
      return session.url;
    });
  return { url: session };
}

export async function getActiveSubscription() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) {
    return { error: error.message };
  }
  if (!user) {
    return { error: 'User not found' };
  }

  const user_data = await prisma.users.findUnique({
    where: {
      id: user.id,
    },
  });

  if (!user_data) {
    return { error: 'User not found' };
  }

  if (!user_data.stripe_customer_id) {
    return { error: 'Stripe customer ID not found' };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
  const subscriptions = await stripe.subscriptions.list({
    customer: user_data.stripe_customer_id,
  });

  // @ts-ignore
  const subscription = subscriptions.data.find((subscription) => subscription.plan.active);
  if (!subscription) {
    return { error: 'Nenhuma assinatura ativa' };
  }

  return { subscription: subscription };
}
