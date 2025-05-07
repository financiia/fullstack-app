import Stripe from 'stripe';
import { createClient } from '@/utils/supabase/server-internal';

export async function invoices() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: error?.message || 'User not found' };
  }

  // Get stripe customer id
  const { data: user_data } = await supabase.from('users').select().eq('id', user.id).single();

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
  const { data: user_data } = await supabase.from('users').select().eq('id', user.id).single();
  if (!user_data) {
    return { error: 'Customer not found' };
  }
  if (!user_data.stripe_customer_id) {
    return { error: 'Customer not found' };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
  const session = await stripe.billingPortal.sessions
    .create({
      customer: user_data.stripe_customer_id,
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

  const { data: user_data } = await supabase.from('users').select().eq('id', user.id).single();

  if (!user_data) {
    return { error: 'Usuário não encontrado' };
  }

  if (!user_data.stripe_customer_id) {
    return { error: 'ID do cliente Stripe não encontrado' };
  }

  if (!user_data.stripe_active_subscription_id) {
    return { error: 'Nenhum plano ativo' };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
  const subscription = await stripe.subscriptions.retrieve(user_data.stripe_active_subscription_id);
  if (!subscription) {
    return { error: 'Nenhum plano ativo' };
  }

  return { subscription };
}
