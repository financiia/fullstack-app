import { NextRequest } from 'next/server';
import Waha from '@/lib/waha';
import ChatGPT from '@/lib/chatgpt';
import prisma from '@/lib/prisma';
import { createClient } from '@deepgram/sdk';
import { groupBy, sumBy } from 'lodash';

/**
 * Handles incoming WhatsApp webhook requests
 */
class WhatsAppWebhookHandler {
  private waha: Waha;
  private chatgpt: ChatGPT;

  constructor() {
    this.waha = new Waha();
    this.chatgpt = new ChatGPT();
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
  private async handleUnregisteredUser(messageId: string, from: string) {
    const message = `
Crie uma conta no site https://fullstack-next.fly.dev/

Lá você poderá registrar o seu número de telefone e começar a usar o bot!
    
Espero poder te ajudar no futuro!
    `.trim();
    await this.waha.sendMessageWithTyping(messageId, from, message);
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
  private async handleHistory(messageId: string, from: string, userId: string) {
    const transactions = await prisma.transactions.findMany({
      where: { user_id: userId },
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
  private async handleSummary(messageId: string, from: string, userId: string) {
    const transactions = await prisma.transactions.findMany({
      where: { user_id: userId },
    });

    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const transactionsLast30Days = transactions.filter((transaction) => new Date(transaction.data) >= last30Days);
    const groupedByCategory = groupBy(transactionsLast30Days, 'categoria');
    const sortedCategories = Object.entries(groupedByCategory)
      .map(([category, groupTransactions]) => ({
        category,
        total: sumBy(groupTransactions, 'valor'),
        porcentagem: (sumBy(groupTransactions, 'valor') / sumBy(transactions, 'valor')) * 100,
        quantidade: groupTransactions.length,
      }))
      .sort((a, b) => b.total - a.total);

    const message = `
*Resumo de transações dos últimos 30 dias:*

${sortedCategories.map((category) => `*${category.category}* - R$ ${category.total} - ${category.porcentagem.toFixed(0)}% - ${category.quantidade} transações`).join('\n')}
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

    // Ignore messages from self or specific number
    if (fromMe || from === '5512981638494@c.us') {
      return Response.json({ status: 200, message: 'Webhook received' });
    }

    // Check if user exists
    const user = await prisma.users.findFirst({
      where: { phone: from },
    });

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

    if (processedMessage === '\\historico') {
      await this.handleHistory(id, from, user.id);
      return Response.json({ status: 200, message: 'Handled' });
    }

    if (processedMessage === 'resumo') {
      await this.handleSummary(id, from, user.id);
      return Response.json({ status: 200, message: 'Handled' });
    }

    // Process message with ChatGPT
    const response = await this.chatgpt.getResponseREST(processedMessage);
    if (response.tipo === 'ignorado') {
      await this.waha.sendReactionJoinha(id, from);
      return Response.json({ status: 200, message: 'Ignorado' });
    }

    // Save transaction and send response
    const messageId = await this.waha.sendMessageWithTyping(id, from, response.beautify.trim());
    await prisma.transactions.create({
      data: {
        user_id: user.id,
        categoria: response.categoria,
        valor: response.valor,
        data: response.data,
        descricao: response.descricao,
        whatsapp_message_id: messageId,
      },
    });

    return Response.json({ status: 200, message: 'Webhook received' });
  }
}

// Export POST handler
export async function POST(request: NextRequest) {
  const handler = new WhatsAppWebhookHandler();
  return handler.handleRequest(request);
}
