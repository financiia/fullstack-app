import Waha from '@/lib/waha';
import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function GET(request: NextRequest) {
  const session_id = request.nextUrl.searchParams.get('session_id');
  if (!session_id) {
    return Response.json({ error: 'Session ID is required' }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
  const session = await stripe.checkout.sessions.retrieve(session_id);

  const userIdFromSession = session.client_reference_id;
  if (!userIdFromSession) {
    return Response.json({ error: 'User ID from session is required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: publicUser } = await supabase
    .from('users')
    .select('id, whatsapp_phone')
    .eq('id', userIdFromSession)
    .single();

  if (!publicUser || !publicUser.whatsapp_phone) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  // Redirect to dashboard and send welcome message on waha
  const waha = new Waha();
  await waha.sendMessageWithTyping(
    null,
    publicUser.whatsapp_phone,
    `
Olá, eu sou a Marill.IA, a assistente virtual da Financiia!

Você acabou de assinar o plano PRO, e está pronto para começar a organizar a sua vida financeira!

Basta você me mandar suas despesas por aqui com um explicativo simples, que vou salvar tudo e manter você informado sobre o seu dinheiro!

*Se você quiser cancelar alguma transação cadastrada, basta fazê-lo pelo dashboard ou simplesmente me mandar um "cancelar", marcando a transação que você quer cancelar.

Vamos começar?
`.trim(),
  );

  await supabase
    .from('users')
    .update({
      stripe_customer_id: session.customer as string,
      stripe_active_subscription_id: session.subscription as string,
    })
    .eq('id', userIdFromSession);

  await supabase.auth.admin.updateUserById(userIdFromSession, {
    phone_confirm: true,
  });

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/dashboard`);
}
