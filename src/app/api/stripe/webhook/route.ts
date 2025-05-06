import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import prisma from '@/lib/prisma';
import Waha from '@/lib/waha';

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

  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      console.log('Checkout session completed', session);
      const userId = session.client_reference_id;
      if (!userId) {
        console.error('User ID not found in session');
        return new Response('User ID not found', { status: 400 });
      }
      const user = await prisma.users.update({
        where: { id: userId },
        data: { stripe_customer_id: session.customer as string },
      });
      const waha = new Waha();
      await waha.sendMessageWithTyping(
        null,
        user?.phone as string,
        'Cadastro concluido! Agora você pode começar a usar a Marill.IA!',
      );
      break;
    default:
      console.log('Unhandled event type', event.type);
      break;
  }

  return new Response('Webhook received', { status: 200 });
}
