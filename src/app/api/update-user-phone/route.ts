import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import Waha from '@/lib/waha';

export async function POST(request: NextRequest) {
  let { phone, user_id } = await request.json();

  if (phone.length !== 11) {
    return Response.json({ error: 'Invalid phone number' }, { status: 400 });
  }

  const user = await prisma.users.findUnique({
    where: { id: user_id },
  });

  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  phone = '55' + phone + '@c.us';
  await prisma.users.update({
    where: { id: user_id },
    data: { phone },
  });

  const waha = new Waha();
  waha.sendMessageWithTyping(
    null,
    phone,
    `
Olá, eu sou a Marill.IA, a assistente virtual da Financiia!

Você acabou de assinar o plano PRO, e está pronto para começar a organizar a sua vida financeira!

Basta você me mandar suas despesas por aqui com um explicativo simples, que vou salvar tudo e manter você informado sobre o seu dinheiro!

*Se você quiser cancelar alguma transação cadastrada, basta fazê-lo pelo dashboard ou simplesmente me mandar um "cancelar", marcando a transação que você quer cancelar.*

*Qualquer mensagem que não seja uma despesa, será apenas respondida com um "👍"*

Vamos começar?
    `.trim(),
  );

  return Response.json({ message: 'Phone number updated successfully' }, { status: 200 });
}
