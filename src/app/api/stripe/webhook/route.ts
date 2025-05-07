import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import Waha from '@/lib/waha';
import { createClient } from '@/utils/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(req: NextRequest) {
  // validate the webhook signature
  const signature = req.headers.get('Stripe-Signature');
  if (!signature) {
    return new Response('Unauthorized', { status: 401 });
  }

  const event = stripe.webhooks.constructEvent(
    await req.text(),
    signature,
    process.env.STRIPE_WEBHOOK_SECRET as string,
  );

  const supabase = await createClient();

  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;
      if (!userId) {
        console.error('User ID not found in session');
        return new Response('User ID not found', { status: 400 });
      }

      const { data: user } = await supabase
        .from('users')
        .update({
          stripe_customer_id: session.customer as string,
          stripe_active_subscription_id: session.subscription as string,
        })
        .eq('id', userId)
        .select('whatsapp_phone')
        .single();
      if (!user || !user.whatsapp_phone) {
        console.error('User not found');
        return new Response('User not found', { status: 404 });
      }

      const waha = new Waha();
      await waha.sendMessageWithTyping(
        null,
        user?.whatsapp_phone as string,
        'Cadastro concluido! Agora você pode começar a usar a Marill.IA!',
      );
      break;
    default:
      console.log('Unhandled event type', event.type);
      break;
  }

  return new Response('Webhook received', { status: 200 });
}
