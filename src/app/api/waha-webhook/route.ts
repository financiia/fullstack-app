import { NextRequest } from 'next/server';
import Waha from '@/lib/waha';
import ChatGPT from '@/lib/chatgpt';
import prisma from '@/lib/prisma';
import { createClient } from '@deepgram/sdk';
import { capitalize, groupBy, sumBy } from 'lodash';
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

/**
 * Handles incoming WhatsApp webhook requests
 */
export class WhatsAppWebhookHandler {
  private waha: Waha;
  private chatgpt: ChatGPT;
  private supabase: SupabaseClient;
  private stripe: Stripe;
  private user: Awaited<ReturnType<typeof prisma.users.findUnique>> | undefined;
  private payload: any;

  constructor() {
    this.waha = new Waha();
    this.chatgpt = new ChatGPT();
    this.supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Never expose this to the client!
    );
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
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
    // Cria o usuário
    const {
      data: { user },
    } = await this.supabase.auth.admin.createUser({
      email: from.split('@')[0] + '@supabase.io',
      email_confirm: true,
    });

    const contactInfo = await this.waha.getContactInfo(from);
    if (!contactInfo) {
      throw new Error('Failed to get contact info');
    }

    await prisma.users.update({
      where: { id: user?.id },
      data: { phone: from, whatsapp_phone: from, nickname: contactInfo.pushname, phone_confirmed_at: new Date() },
    });

    const session = await this.createStripeLink(user?.id as string);
    if (!session) {
      throw new Error('Failed to create stripe link');
    }

    const message = `
*Bem-vindo à Financi.IA!*

Eu sou a *Marill.IA*, sua assistente financeira. Já criei uma conta no nosso sistema para o seu telefone.

Para começar a usar a plataforma, você pode iniciar seu teste grátis de 30 dias pelo link: ${session.url}

Espero poder te ajudar no futuro!
    `.trim();
    await this.waha.sendMessageWithTyping(null, from, message);
  }

  /**
   * Handles transaction cancellation request
   */
  private async handleCancellation(messageId: string, from: string, userId: string, replyTo?: { id: string }) {
    if (!replyTo?.id) {
      await this.waha.sendMessageWithTyping(messageId, from, 'Você deve marcar a transação que você quer cancelar.');
      return;
    }

    const transactions = await prisma.transactions.findMany({
      where: {
        user_id: userId,
        whatsapp_message_id: replyTo.id,
      },
    });

    if (transactions.length === 0) {
      await this.waha.sendMessageWithTyping(
        messageId,
        from,
        'Não foi possível encontrar a transação que você quer cancelar.',
      );
      return;
    }

    await prisma.transactions.delete({
      where: {
        id: transactions[0].id,
      },
    });

    await this.waha.sendMessageWithTyping(messageId, from, 'Transação cancelada com sucesso!');
  }

  /**
   * Handles transaction history request
   */
  private async handleHistory(
    messageId: string,
    from: string,
    userId: string,
    limit_days?: number,
    limit_transactions?: number,
  ) {
    const transactions = await prisma.transactions.findMany({
      where: {
        user_id: userId,
        data: { gte: limit_days ? new Date(new Date().getTime() - limit_days * 24 * 60 * 60 * 1000) : undefined },
      },
      orderBy: { data: 'desc' },
      take: (limit_transactions ?? limit_days) ? 30 : 5,
    });

    const message = `
*Histórico de transações:*
${transactions
  .map(
    (transaction) => `
*${new Date(transaction.data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}* - ${transaction.descricao} - R$ ${transaction.valor}`,
  )
  .join('')}
    `.trim();

    await this.waha.sendMessageWithTyping(messageId, from, message);
  }

  /**
   * Handles transaction summary request
   */
  private async handleSummary(messageId: string, from: string, userId: string, last_30_days: boolean) {
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);

    const transactions = await prisma.transactions.findMany({
      where: {
        user_id: userId,
        data: { gte: last_30_days ? new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000) : firstDayOfMonth },
      },
    });

    const groupedByCategory = groupBy(transactions, 'categoria');
    const sortedCategories = Object.entries(groupedByCategory)
      .map(([category, groupTransactions]) => ({
        category,
        total: sumBy(groupTransactions, (t) => +t.valor),
        porcentagem: (sumBy(groupTransactions, (t) => +t.valor) / sumBy(transactions, (t) => +t.valor)) * 100,
        quantidade: groupTransactions.length,
      }))
      .sort((a, b) => b.total - a.total);

    const message = `
*Resumo de transações dos últimos 30 dias:*

${sortedCategories.map((category) => `*${capitalize(category.category)}* - R$ ${category.total} - ${category.porcentagem.toFixed(0)}% - ${category.quantidade} transações`).join('\n')}
    `.trim();

    await this.waha.sendMessageWithTyping(messageId, from, message);
  }

  /**
   * Main handler for webhook requests
   */
  public async handleRequest(request: NextRequest) {
    const requestBody = await request.json();
    const {
      payload: { id, body: message, from, fromMe, hasMedia, media, replyTo },
    } = requestBody;
    this.payload = requestBody.payload;

    // Ignore messages from self or specific number
    if (fromMe || from === '5512981638494@c.us') {
      return Response.json({ status: 200, message: 'Webhook received' });
    }

    // Check if user exists
    const user = await prisma.users.findFirst({
      where: { phone: from },
    });
    this.user = user;

    if (!user) {
      await this.handleUnregisteredUser(id, from);
      return Response.json({ status: 200, message: 'Handled' });
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

    // Handle special commands
    if (processedMessage === 'cancelar') {
      await this.handleCancellation(id, from, user.id, replyTo);
      return Response.json({ status: 200, message: 'Webhook received' });
    }

    // if (processedMessage === '\\historico') {
    //   await this.handleHistory(id, from, user.id);
    //   return Response.json({ status: 200, message: 'Handled' });
    // }

    // if (processedMessage === 'resumo') {
    //   await this.handleSummary(id, from, user.id);
    //   return Response.json({ status: 200, message: 'Handled' });
    // }

    let assistantMessage = null;
    if (replyTo?.id) {
      const message = await this.waha.getMessage(replyTo.id);
      assistantMessage = message.body;
    }
    // Process message with ChatGPT
    const functionCalled = await this.chatgpt.getResponseREST(processedMessage, assistantMessage);

    await this.handleFunctionCall(functionCalled);
  }

  async handleFunctionCall(functionCalled: { name: string; arguments: string }) {
    switch (functionCalled.name) {
      case 'cancel_subscription':
        // return this.waha.sendMessageWithButtons(null, '5521936181803@c.us', [{ type: 'reply', text: 'Cancelar Plano' }], 'Você tem certeza que deseja cancelar o seu plano?', 'Se sim, clique no botão abaixo', 'A ação poderá ser desfeita até o dia 30/05');
        return this.waha.sendMessageWithTyping(
          this.payload.id,
          this.payload.from,
          '*CANCELAMENTO DE ASSINATURA*\n\nVocê tem certeza que deseja cancelar o seu plano?\n\nSe sim, responda essa mensagem com "cancelar"',
        );
      case 'cancel_subscription_confirmation':
        // Get stripe customer
        const stripeCustomer = await this.stripe.customers.retrieve(this.user!.stripe_customer_id as string);
        // Get active subscription
        const subscriptions = await this.stripe.subscriptions.list({
          customer: stripeCustomer.id,
        });
        // @ts-ignore
        const activeSubscription = subscriptions.data.find((subscription) => subscription.plan.active);
        if (!activeSubscription) {
          // await this.stripe.subscriptions.cancel(this.user!.stripe_subscription_id);
          return this.waha.sendMessageWithTyping(
            this.payload.id,
            this.payload.from,
            'Você não possui uma assinatura ativa. Entre em contato com o suporte.',
          );
        }

        // Cancel subscription
        await this.stripe.subscriptions.cancel(activeSubscription.id);

        return this.waha.sendMessageWithTyping(this.payload.id, this.payload.from, 'Assinatura cancelada com sucesso!');
      case 'register_transaction':
        const transaction = JSON.parse(functionCalled.arguments);

        // Save transaction and send response
        const messageId = await this.waha.sendMessageWithTyping(
          this.payload.id,
          this.payload.from,
          this.beautifyTransaction(transaction),
        );
        await prisma.transactions.create({
          data: {
            user_id: this.user!.id,
            categoria: transaction.categoria,
            valor: transaction.valor,
            data: transaction.data,
            descricao: transaction.descricao,
            whatsapp_message_id: messageId,
          },
        });
        return;
      case 'update_transaction':
        const transactionUpdate = JSON.parse(functionCalled.arguments);
        const currentTransaction = await prisma.transactions.findFirst({
          where: {
            user_id: this.user!.id,
            whatsapp_message_id: this.payload.replyTo.id,
          },
        });

        if (!currentTransaction) {
          await this.waha.sendMessageWithTyping(
            this.payload.id,
            this.payload.from,
            'Não foi possível encontrar a transação que você quer atualizar. Entre em contato com o suporte.',
          );
          return;
        }

        await prisma.transactions.update({
          where: { id: currentTransaction!.id },
          data: transactionUpdate,
        });

        await this.waha.sendMessageWithTyping(this.payload.id, this.payload.from, 'Transação atualizada com sucesso!');
        return;
      case 'cancel_transaction':
        await this.handleCancellation(this.payload.id, this.payload.from, this.user!.id, this.payload.replyTo);
        return;
      case 'no_action':
        return this.waha.sendMessageWithTyping(
          this.payload.id,
          this.payload.from,
          JSON.parse(functionCalled.arguments).message,
        );
      case 'explain_usage':
        return this.waha.sendMessageWithTyping(this.payload.id, this.payload.from, this._explainUsageMessage());
      case 'get_last_transactions':
        const { limit_days, limit_transactions } = JSON.parse(functionCalled.arguments);
        return this.handleHistory(this.payload.id, this.payload.from, this.user!.id, limit_days, limit_transactions);
      case 'monthly_spending_summary':
        return this.handleSummary(this.payload.id, this.payload.from, this.user!.id, false);
      case 'spending_summary_30_days':
        return this.handleSummary(this.payload.id, this.payload.from, this.user!.id, true);
      case 'define_monthly_goal':
        const { tipo, valor } = JSON.parse(functionCalled.arguments);
        return this.waha.sendMessageWithTyping(
          this.payload.id,
          this.payload.from,
          this._defineMonthlyGoalMessage(tipo, valor),
        );
      default:
        return 'Function not found';
    }
  }

  beautifyTransaction(transaction: {
    tipo: string;
    valor: number;
    categoria: string;
    data: string;
    descricao: string;
    recorrente: boolean;
  }) {
    return `
Despesa registrada! Confira os detalhes:

Valor: *R$ ${transaction.valor.toFixed(2)}*
Categoria: *${capitalize(transaction.categoria)}*
Data: ${new Date(transaction.data).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}
Descrição: ${capitalize(transaction.descricao)}
    `.trim();
  }

  _explainUsageMessage() {
    return `
O bot é uma ferramenta para ajudar você a gerenciar suas finanças.

Você pode registrar despesas e receitas, consultar seu saldo, e muito mais!

Para registrar uma despesa, basta descrever a transação em uma mensagem simples ou em áudio.

Você pode, ainda, me perguntar sobre suas últimas transações, resumo do gasto do mês e definição de metas mensais.
    `.trim();
  }

  _defineMonthlyGoalMessage(tipo: string, valor: number) {
    return `
Meta mensal definida!

Agora sua meta mensal é de *R$ ${valor.toFixed(2)}* para a categoria *${capitalize(tipo)}*.
    `.trim();
  }

  async showErrorMessage() {
    return this.waha.sendMessageWithTyping(
      this.payload.id,
      this.payload.from,
      'Ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.',
    );
  }

  async createStripeLink(userId: string) {
    return await this.stripe.checkout.sessions.create({
      client_reference_id: userId,
      billing_address_collection: 'auto',
      line_items: [
        {
          price: 'price_1RLQMPPGjwv1HAuwRuvVQK6t',
          // For metered billing, do not pass quantity
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 30,
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel',
          },
        },
      },
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_URL}/api/stripe/success?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL}/api/stripe/cancel?canceled=true`,
      locale: 'pt-BR',
    });
  }
}

// Export POST handler
export async function POST(request: NextRequest) {
  const handler = new WhatsAppWebhookHandler();
  try {
    await handler.handleRequest(request);
  } catch (e) {
    console.error(e);
    await handler.showErrorMessage();
  }

  return Response.json({ status: 200, message: 'Webhook received' });
}
