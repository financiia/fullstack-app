import { NextRequest } from 'next/server';
import Waha from '@/lib/waha';
import ChatGPT from '@/lib/chatgpt';
import { createClient } from '@deepgram/sdk';
import Stripe from 'stripe';
import { Database } from '@/lib/database.types';
import { createClient as createSupabaseClient } from '@/utils/supabase/server-internal';
import UnregisteredAgent from '@/lib/ai/unregistered';
import BaseAgent from '@/lib/ai/base';
import { createCheckoutSession } from '@/utils/stripe/server';
import OpenAI from 'openai';
import FunctionHandler from '@/lib/ai/base-handler';
/**
 * Handles incoming WhatsApp webhook requests
 */
export class WhatsAppWebhookHandler {
  private waha: Waha;
  private chatgpt: ChatGPT;
  // @ts-expect-error Supabase client is not available in the constructor
  private supabase: Awaited<ReturnType<typeof createSupabaseClient>>;
  private stripe: Stripe;
  private user: Database['public']['Tables']['users']['Row'] | undefined;
  private nextRequest: NextRequest;
  // @ts-expect-error Request json is not available in the constructor
  private payload: {
    id: string;
    body: string;
    from: string;
    fromMe: boolean;
    hasMedia: boolean;
    media: { url: string; mimetype: string };
    replyTo: { id: string; body: string };
    timestamp: number;
  };

  constructor(nextRequest: NextRequest) {
    this.waha = new Waha();
    this.chatgpt = new ChatGPT();
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    this.nextRequest = nextRequest;
  }

  async setupInstance() {
    this.payload = (await this.nextRequest.json()).payload;
    this.supabase = await createSupabaseClient();
    const { data: user } = await this.supabase.from('users').select().eq('whatsapp_phone', this.payload.from).single();
    this.user = user ?? undefined;
  }

  /**
   * Transcribes audio URL using Deepgram API
   */
  private async transcribeAudio(url: string) {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

    const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
      { url },
      {
        model: 'nova-2',
        smart_format: true,
        language: 'pt-BR',
      },
    );

    if (error) throw error;
    return result.results.channels[0].alternatives[0];
  }

  /**
   * Handles message from unregistered user
   */
  async handleUnregisteredUser(messageId: string | null, from: string) {
    const messageHistory = await this.waha.getMessages(from);
    const messageHistoryGPT = messageHistory.map((message: typeof this.payload) => {
      let messageOutput = message.id + ': ' + message.body;

      if (message.replyTo?.id) {
        messageOutput = 'In reply to: ' + message.replyTo.id + '\n\n' + messageOutput;
      }

      const output = {
        role: message.fromMe ? 'assistant' : 'user',
        content: messageOutput,
      };
      return output;
    });
    const unregisteredAgent = new UnregisteredAgent(messageHistoryGPT);
    const { functionCalled, outputMessage } = await unregisteredAgent.getResponse(this.payload.body);

    if (!outputMessage && !functionCalled) {
      await this.waha.sendMessageWithTyping(messageId, from, 'Erro do servidor. Tente novamente mais tarde.');
      return;
    }

    if (outputMessage) {
      await this.waha.sendMessageWithTyping(messageId, from, outputMessage);
    }
    if (functionCalled) {
      // await this.handleFunctionCall(functionCalled);
      console.log('FUNCTION CALLED: ', functionCalled);
      if (functionCalled.name === 'registrar_usuario') {
        // Cria o usuário
        const {
          data: { user },
        } = await this.supabase.auth.admin.createUser({
          email: from.split('@')[0] + '@supabase.io',
          email_confirm: true,
        });

        if (!user) {
          throw new Error('Failed to create user');
        }

        const contactInfo = await this.waha.getContactInfo(from);
        if (!contactInfo) {
          throw new Error('Failed to get contact info');
        }

        await this.supabase.from('users').insert({
          id: user.id,
          whatsapp_phone: from,
          nickname: contactInfo.pushname,
        });

        const session = await createCheckoutSession(undefined, user.id);
        if (!session) {
          throw new Error('Failed to create stripe link');
        }

        const message = `
*Bem-vindo à Financi.IA!*

Obrigado por se cadastrar!

Para começar a usar a plataforma, você pode iniciar seu teste grátis de 30 dias pelo link: ${session.url}

Espero poder te ajudar no futuro!
        `.trim();
        await this.waha.sendMessageWithTyping(null, from, message);
      }
    }
  }

  /**
   * Main handler for webhook requests
   */
  public async handleRequest() {
    const { id, body: message, from, fromMe, hasMedia, media } = this.payload;

    // Ignore messages from self or specific number
    if (fromMe || from === '5512981638494@c.us') {
      return Response.json({ status: 200, message: 'Webhook received' });
    }

    // Handle audio messages
    let processedMessage = message;
    if (hasMedia && media.mimetype.startsWith('audio/')) {
      const transcription = await this.transcribeAudio(media.url);
      if (transcription.confidence < 0.8) {
        await this.waha.sendMessageWithTyping(
          id,
          from,
          'Não consegui entender o que você disse. Por favor, tente novamente.',
        );
        return Response.json({ status: 200, message: 'Webhook received' });
      }
      processedMessage = transcription.transcript;
    }

    if (!this.user) {
      return this.handleUnregisteredUser(id, from);
    }

    let messageHistory: (typeof this.payload)[] = await this.waha.getMessages(from);
    messageHistory.sort((a, b) => a.timestamp - b.timestamp);
    messageHistory = messageHistory.slice(-10); // Só as últimas 10 mensagens
    messageHistory[messageHistory.length - 1].body = processedMessage; // Caso seja áudio.

    const messageHistoryGPT: OpenAI.Responses.ResponseInputItem[] = messageHistory.map(
      (message: typeof this.payload) => {
        const output: OpenAI.Responses.ResponseInputItem = {
          role: message.fromMe ? 'assistant' : 'user',
          content: message.body,
        };
        return output;
      },
    );

    const baseAgent = new BaseAgent(messageHistoryGPT);
    const serverHandler = new FunctionHandler(this.payload, this.user!, this.supabase, this.stripe, this.waha);
    const tokens = await baseAgent.getResponse(serverHandler);
    this.logger(`Total de tokens gastos: ${tokens}`);
  }

  async showErrorMessage() {
    return this.waha.sendMessageWithTyping(
      this.payload.id,
      this.payload.from,
      'Ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
    );
  }

  logger(message: string, level: 'log' | 'info' | 'error' = 'log') {
    console[level]('\x1b[34m WEBHOOK HANDLER: \x1b[0m ', message);
  }
}

// Export POST handler
export async function POST(request: NextRequest) {
  const handler = new WhatsAppWebhookHandler(request);
  await handler.setupInstance();
  await handler.handleRequest().catch(async (e) => {
    console.error(e);
    await handler.showErrorMessage().catch((e) => {
      console.error(e);
    });
  });

  return Response.json({ status: 200, message: 'Webhook received' });
}
