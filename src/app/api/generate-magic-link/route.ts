import { NextRequest } from 'next/server';
import Waha from '@/lib/waha';
import { createClient } from '@/utils/supabase/server-internal';

export async function POST(req: NextRequest) {
  let { phone } = await req.json();
  phone = '55' + phone.replace(/\D/g, '');
  const whatsappPhone = phone + '@c.us';
  const supabase = await createClient();

  // Check if user already exists
  let { data: publicUser } = await supabase.from('users').select('id, nickname').eq('phone', whatsappPhone).single();

  let userID = publicUser?.id;
  if (!userID) {
    const {
      data: { user },
      error,
    } = await supabase.auth.admin.createUser({
      email: phone + '@supabase.io',
      email_confirm: true,
    });
    if (error || !user) {
      return Response.json({ error: error?.message || 'No link returned' }, { status: 500 });
    }

    userID = user.id;
    const response = await supabase.from('users').insert({ id: userID, whatsapp_phone: whatsappPhone });
    publicUser = response.data;
  }

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: phone + '@supabase.io',
  });

  if (error || !data?.properties?.action_link) {
    return Response.json({ error: error?.message || 'No link returned' }, { status: 500 });
  }

  const OTP = data.properties.email_otp;
  // Send via WhatsApp
  const waha = new Waha();
  await waha.sendMessageWithTyping(null, whatsappPhone, 'Seu código de verificação é: ' + OTP);

  if (!publicUser?.nickname) {
    const contactInfo = await waha.getContactInfo(whatsappPhone);
    await supabase.from('users').update({ nickname: contactInfo.pushname }).eq('id', userID);
  }

  return Response.json({ message: 'OTP sent via WhatsApp' }, { status: 200 });
}
