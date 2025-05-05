import { NextRequest } from 'next/server';
import Waha from '@/lib/waha';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const { userId } = await req.json();
  console.log('Sending welcome message to user: ', userId);
  // Usa o prisma para pegar as infos do usuário
  const user = await prisma.users.findUnique({
    where: {
      id: userId,
    },
  });
  if (!user) {
    return Response.json({ status: 404, message: 'User not found' });
  }
  if (user?.phone_confirmed_at) {
    return Response.json({ status: 400, message: 'User already confirmed phone' });
  }

  await prisma.users.update({
    where: {
      id: userId,
    },
    data: {
      phone_confirmed_at: new Date().toISOString(),
    },
  });
  const waha = new Waha();
  await waha.sendMessageWithTyping(
    null,
    user?.phone!,
    `
Olá, eu sou a Marill.IA, a assistente virtual da Financiia!

Você acabou de assinar o plano PRO, e está pronto para começar a organizar a sua vida financeira!

Basta você me mandar suas despesas por aqui com um explicativo simples, que vou salvar tudo e manter você informado sobre o seu dinheiro!

*Se você quiser cancelar alguma transação cadastrada, basta fazê-lo pelo dashboard ou simplesmente me mandar um "cancelar", marcando a transação que você quer cancelar.

Vamos começar?
`.trim(),
  );

  return Response.json({ status: 200, message: 'Welcome message sent' });
}
