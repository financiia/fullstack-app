import { NextRequest } from 'next/server';
import { ProcessWebhook } from '@/utils/paddle/process-webhook';
import Waha from '@/lib/waha';
import ChatGPT from '@/lib/chatgpt';
import prisma from '@/lib/prisma';
import { createClient } from '@deepgram/sdk';

const webhookProcessor = new ProcessWebhook();

export async function POST(request: NextRequest) {
  const requestBody = await request.json();
  let {
    payload: { id, body: message, from, fromMe, hasMedia, media, replyTo },
  } = requestBody;
  if (fromMe) {
    return Response.json({ status: 200, message: 'Webhook received' });
  }
  if (from === '5512981638494@c.us') {
    return Response.json({ status: 200, message: 'Webhook received' });
  }

  // Checa se o telefone é de algum usuário
  // Usa o WAHA para mandar um status READ na mensagem, mandar o digitando e devolver a mensagem
  const waha = new Waha();
  const chatgpt = new ChatGPT();

  // Get first user and change it's phone number to from
  const user = await prisma.users.findFirst({
    where: {
      phone: from,
    },
  });
  // Se não achar, retorna uma mensagem falando que eh pra criar uma conta no site
  if (!user) {
    const message = `
Crie uma conta no site https://fullstack-next.fly.dev/

Lá você poderá registrar o seu número de telefone e começar a usar o bot!
    
Espero poder te ajudar no futuro!
        `.trim();
    await waha.sendMessageWithTyping(id, from, message);
    return Response.json({ status: 200, message: 'Handled' });
  }

  if (hasMedia) {
    // Checa se a media é um audio
    if (media.mimetype.startsWith('audio/')) {
      const audioUrl = media.url;
      const transcription = await transcribeUrl(audioUrl);
      if (transcription.confidence < 0.8) {
        await waha.sendMessageWithTyping(
          id,
          from,
          'Não consegui entender o que você disse. Por favor, tente novamente.',
        );
        return Response.json({ status: 200, message: 'Webhook received' });
      }
      message = transcription.transcript;
    }
  }

  if (message === 'cancelar') {
    if (!replyTo?.id) {
      await waha.sendMessageWithTyping(id, from, 'Você deve marcar a transação que você quer cancelar.');
      return Response.json({ status: 200, message: 'Webhook received' });
    }
    const transactions = await prisma.transactions.findMany({
      where: {
        user_id: user.id,
        whatsapp_message_id: replyTo.id,
      },
    });
    if (transactions.length === 0) {
      await waha.sendMessageWithTyping(id, from, 'Não foi possível encontrar a transação que você quer cancelar.');
      return Response.json({ status: 200, message: 'Webhook received' });
    }
    await prisma.transactions.delete({
      where: {
        id: transactions[0].id,
      },
    });
    await waha.sendMessageWithTyping(id, from, 'Transação cancelada com sucesso!');
    return Response.json({ status: 200, message: 'Webhook received' });
  }

  if (message === '\\historico') {
    const transactions = await prisma.transactions.findMany({
      where: {
        user_id: user.id,
      },
    });

    const message = `
*Histórico de transações:*
${transactions
  .map(
    (transaction) => `
*${new Date(transaction.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}* - ${transaction.descricao} - R$ ${transaction.valor}`,
  )
  .join('')}
        `.trim();

    await waha.sendMessageWithTyping(id, from, message);
    return Response.json({ status: 200, message: 'Handled' });
  }

  const response = await chatgpt.getResponseREST(message);
  if (response.tipo === 'ignorado') {
    await waha.sendReactionJoinha(id, from);
    return Response.json({ status: 200, message: 'Ignorado' });
  }

  const messageId = await waha.sendMessageWithTyping(id, from, response.beautify.trim());
  // Salva a transaction no banco de dados
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

const transcribeUrl = async (url: string) => {
  // STEP 1: Create a Deepgram client using the API key
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
  // STEP 2: Call the transcribeUrl method with the audio payload and options
  const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
    {
      url: url,
    },
    // STEP 3: Configure Deepgram options for audio analysis
    {
      model: 'nova-2',
      smart_format: true,
      language: 'pt-BR',
    },
  );
  if (error) throw error;
  // STEP 4: Print the results
  if (!error) console.dir(result, { depth: null });
  return result.results.channels[0].alternatives[0];
};
