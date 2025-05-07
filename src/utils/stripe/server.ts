import Stripe from 'stripe';
import { createClient } from '@/utils/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

async function userStripeData() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error(error?.message || 'Unauthorized');
  }
  const { data: user_data } = await supabase
    .from('users')
    .select('id, stripe_customer_id, stripe_active_subscription_id')
    .eq('id', user?.id)
    .single();
  if (!user_data) {
    throw new Error('User not found');
  }

  return user_data;
}
export async function getInvoices() {
  const { stripe_customer_id } = await userStripeData();
  if (!stripe_customer_id) {
    return undefined;
  }

  const invoices = await stripe.invoices.list({
    customer: stripe_customer_id,
  });
  return invoices;
}

export async function getSubscriptions() {
  const { stripe_customer_id } = await userStripeData();
  if (!stripe_customer_id) {
    return undefined;
  }
  const subscriptions = await stripe.subscriptions.list({
    customer: stripe_customer_id,
  });
  return subscriptions;
}

export async function getActiveSubscription() {
  const { stripe_active_subscription_id } = await userStripeData();
  if (!stripe_active_subscription_id) {
    return undefined;
  }
  const subscription = await stripe.subscriptions.retrieve(stripe_active_subscription_id);
  return subscription;
}

export async function createCheckoutSession(priceId = 'price_1RLQMPPGjwv1HAuwRuvVQK6t', userId?: string) {
  if (!userId) {
    const { id } = await userStripeData();
    userId = id;
  }

  const session = await stripe.checkout.sessions.create({
    client_reference_id: userId,
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
  return session;
}
