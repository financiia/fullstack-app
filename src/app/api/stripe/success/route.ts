import Waha from '@/lib/waha';
import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session_id = request.nextUrl.searchParams.get('session_id');
  if (!session_id) {
    return Response.json({ error: 'Session ID is required' }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
  const session = await stripe.checkout.sessions.retrieve(session_id);

  const userIdFromSession = session.client_reference_id;
  // Confirm it is the same user
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (user?.id !== userIdFromSession) {
    return Response.json({ error: 'User ID from session does not match' }, { status: 401 });
  }

  // Redirect to dashboard and send welcome message on waha
  const waha = new Waha();
  await waha.sendMessageWithTyping(
    null,
    '5521936181803@c.us',
    `
Olá, eu sou a Marill.IA, a assistente virtual da Financiia!

Você acabou de assinar o plano PRO, e está pronto para começar a organizar a sua vida financeira!

Basta você me mandar suas despesas por aqui com um explicativo simples, que vou salvar tudo e manter você informado sobre o seu dinheiro!

*Se você quiser cancelar alguma transação cadastrada, basta fazê-lo pelo dashboard ou simplesmente me mandar um "cancelar", marcando a transação que você quer cancelar.

Vamos começar?
`.trim(),
  );

  await prisma.users.update({
    where: { id: user?.id },
    data: {
      phone_confirmed_at: new Date(),
      stripe_customer_id: session.customer as string,
    },
  });

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/dashboard`);
}
