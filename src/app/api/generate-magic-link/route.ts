import { NextRequest } from 'next/server';
import { createClient, User } from '@supabase/supabase-js';
import Waha from '@/lib/waha';
import prisma from '@/lib/prisma';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Never expose this to the client!
);

export async function POST(req: NextRequest) {
  const { phone } = await req.json();
  const whatsappPhone = '55' + phone + '@c.us';

  // Check if user already exists
  let userID = await prisma.users
    .findUnique({
      where: { phone: whatsappPhone },
    })
    .then((user) => user?.id);

  if (!userID) {
    const {
      data: { user },
    } = await supabase.auth.admin.createUser({
      email: phone + '@supabase.io',
      email_confirm: true,
    });
    userID = user?.id;

    await prisma.users.update({
      where: { id: userID },
      data: { phone: whatsappPhone },
    });
  }

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: phone + '@supabase.io',
    options: {
      redirectTo: 'http://localhost:3000/signup/verify', // optional
    },
  });

  if (error || !data?.properties?.action_link) {
    return Response.json({ error: error?.message || 'No link returned' }, { status: 400 });
  }

  const OTP = data.properties.email_otp;
  // Send via WhatsApp
  const waha = new Waha();
  await waha.sendMessageWithTyping(null, whatsappPhone, 'Seu código de verificação é: ' + OTP);

  return Response.json({ message: 'Magic link sent via WhatsApp' }, { status: 200 });
}
