import { NextRequest } from 'next/server';
import Waha from '@/lib/waha';
import ChatGPT from '@/lib/chatgpt';
import { createClient } from '@deepgram/sdk';
import { capitalize, groupBy, sumBy } from 'lodash';
import Stripe from 'stripe';
import { Database } from '@/lib/database.types';
import { createClient as createSupabaseClient } from '@/utils/supabase/server-internal';
import UnregisteredAgent from '@/lib/ai/unregistered';
import BaseAgent from '@/lib/ai/base';
import { createCheckoutSession } from '@/utils/stripe/server';
import { TransactionsHandler } from '@/lib/ai/transactions';
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
   * Handles transaction cancellation request
   */
  private async handleCancellation(messageId: string, from: string, userId: string, replyTo?: { id: string }) {
    if (!replyTo?.id) {
      await this.waha.sendMessageWithTyping(messageId, from, 'Você deve marcar a transação que você quer cancelar.');
      return;
    }

    const { data: transactions } = await this.supabase
      .from('transactions')
      .select()
      .eq('user_id', userId)
      .eq('whatsapp_message_id', replyTo.id);

    if (!transactions?.length) {
      await this.waha.sendMessageWithTyping(
        messageId,
        from,
        'Não foi possível encontrar a transação que você quer cancelar.',
      );
      return;
    }

    await this.supabase.from('transactions').delete().eq('id', transactions[0].id);
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
    const { data: transactions } = await this.supabase
      .from('transactions')
      .select()
      .eq('user_id', userId)
      .gte('data', limit_days ? new Date(new Date().getTime() - limit_days * 24 * 60 * 60 * 1000) : undefined)
      .order('data', { ascending: false })
      .limit(limit_transactions ?? limit_days ?? 5);

    if (!transactions?.length) {
      await this.waha.sendMessageWithTyping(
        messageId,
        from,
        'Você não tem nenhuma transação registrada no período selecionado.',
      );
      return;
    }

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

    const { data: transactions } = await this.supabase
      .from('transactions')
      .select()
      .eq('user_id', userId)
      .gte('data', last_30_days ? new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000) : firstDayOfMonth);

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

    const messageHistoryGPT = messageHistory.map((message: typeof this.payload) => {
      // let messageOutput = `${message.id.split('_')[2]}: ${message.body}`;
      // if (!message.fromMe && message.replyTo?.id) {
      //   messageOutput = `In reply to: ${message.replyTo.id} -- ${messageOutput}`;
      // }

      const output = {
        role: message.fromMe ? 'assistant' : 'user',
        content: message.body,
      };
      return output;
    });

    const baseAgent = new BaseAgent(messageHistoryGPT);
    let { functionCalled, outputMessage } = await baseAgent.getResponse();
    if (outputMessage) {
      console.log('OUTPUT MESSAGE: ', outputMessage);
      const messages = outputMessage.split('•');
      for (const message of messages) {
        await this.waha.sendMessageWithTyping(id, from, message.trim());
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    if (functionCalled) {
      if (functionCalled.handler === 'transactions') {
        const transactionsHandler = new TransactionsHandler(
          this.payload,
          this.user!,
          this.supabase,
          this.stripe,
          this.waha,
        );
        await transactionsHandler.handleFunctionCall(functionCalled);
      }
      // await this.waha.sendMessageWithTyping(
      //   id,
      //   from,
      //   `*Function called:* ${functionCalled.name}\n\nArgumentos: ${functionCalled.arguments}`,
      // );
      // await this.handleFunctionCall(functionCalled);
    }
    // Process message with ChatGPT
    // const functionCalled = await this.chatgpt.getResponseREST(processedMessage, replyTo?.body);

    // await this.handleFunctionCall(functionCalled);
  }

  async handleFunctionCall(functionCalled: { name: string; arguments: string }) {
    switch (functionCalled.name) {
      case 'cancel_subscription':
        return this.waha.sendMessageWithTyping(
          this.payload.id,
          this.payload.from,
          '*CANCELAMENTO DE ASSINATURA*\n\nVocê tem certeza que deseja cancelar o seu plano?\n\nSe sim, responda essa mensagem com "cancelar"',
        );
      case 'cancel_subscription_confirmation':
        const activeSubscription = this.user?.stripe_active_subscription_id;
        if (!activeSubscription) {
          return this.waha.sendMessageWithTyping(
            this.payload.id,
            this.payload.from,
            'Você não possui uma assinatura ativa. Entre em contato com o suporte.',
          );
        }

        // Cancel subscription
        await this.stripe.subscriptions.cancel(activeSubscription);

        return this.waha.sendMessageWithTyping(this.payload.id, this.payload.from, 'Assinatura cancelada com sucesso!');
      case 'register_transaction':
        const transaction = JSON.parse(functionCalled.arguments);

        // Save transaction and send response
        const messageId = await this.waha.sendMessageWithTyping(
          this.payload.id,
          this.payload.from,
          this.beautifyTransaction(transaction),
        );
        await this.supabase.from('transactions').insert({
          user_id: this.user!.id,
          categoria: transaction.categoria,
          valor: transaction.valor,
          data: transaction.data,
          descricao: transaction.descricao,
          whatsapp_message_id: messageId,
        });
        return;
      case 'update_transaction':
        const transactionUpdate = JSON.parse(functionCalled.arguments);
        const { data: currentTransaction } = await this.supabase
          .from('transactions')
          .select()
          .eq('user_id', this.user!.id)
          .eq('whatsapp_message_id', this.payload.replyTo.id)
          .single();

        if (!currentTransaction) {
          await this.waha.sendMessageWithTyping(
            this.payload.id,
            this.payload.from,
            'Não foi possível encontrar a transação que você quer atualizar. Entre em contato com o suporte.',
          );
          return;
        }

        await this.supabase.from('transactions').update(transactionUpdate).eq('id', currentTransaction.id);
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
