import { NextRequest } from 'next/server';
import { createClient, User } from '@supabase/supabase-js';
import Waha from '@/lib/waha';
import prisma from '@/lib/prisma';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Never expose this to the client!
);

export async function POST(req: NextRequest) {
  const data = await req.json();

  console.log(data);

  return Response.json({ message: 'Webhook received' }, { status: 200 });
}
