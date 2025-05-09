import { createClient } from '@/utils/supabase/server-internal';
import { Database } from '../database.types';
import Stripe from 'stripe';
import Waha from '@/lib/waha';

export default class FunctionHandler {
  public payload: {
    id: string;
    body: string;
    from: string;
    fromMe: boolean;
    hasMedia: boolean;
    media: { url: string; mimetype: string };
    replyTo: { id: string; body: string };
    timestamp: number;
  };
  public user: Database['public']['Tables']['users']['Row'];
  public supabase: Awaited<ReturnType<typeof createClient>>;
  public stripe: Stripe;
  public waha: Waha;
  constructor(
    payload: typeof this.payload,
    user: Database['public']['Tables']['users']['Row'],
    supabase: Awaited<ReturnType<typeof createClient>>,
    stripe: Stripe,
    waha: Waha,
  ) {
    this.payload = payload;
    this.user = user;
    this.supabase = supabase;
    this.stripe = stripe;
    this.waha = waha;
  }

  async sendMessage(message: string) {
    return this.waha.sendMessageWithTyping(this.payload.id, this.payload.from, message.trim());
  }
}
