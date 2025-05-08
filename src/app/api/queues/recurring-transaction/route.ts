import { TransactionsHandler } from '@/lib/ai/transactions';
import { Database } from '@/lib/database.types';
import Waha from '@/lib/waha';
import { createClient } from '@/utils/supabase/server-internal';
import { Queue } from 'quirrel/next-app';

export const recurringTransactionQueue = Queue(
  'api/queues/recurring-transaction', // 👈 the route it's reachable on
  async (job: Database['public']['Tables']['recurring_transactions']['Row']) => {
    const supabase = await createClient();
    const { data: recurringTransaction } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('id', job.id)
      .single();
    if (!recurringTransaction) {
      throw new Error('Recurring transaction not found');
    }
    const { data: user } = await supabase.from('users').select('*').eq('id', recurringTransaction.user_id).single();
    if (!user) {
      throw new Error('User not found');
    }
    const { data: transaction } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        categoria: recurringTransaction.categoria,
        valor: recurringTransaction.valor,
        data: new Date().toISOString(),
        descricao: recurringTransaction.descricao,
        recurring_transaction_id: recurringTransaction.id,
      })
      .select()
      .single();
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    const waha = new Waha();
    await waha.sendMessageWithTyping(
      null,
      user.whatsapp_phone!,
      `Registrando transação recorrente (#${transaction.id}):`,
    );
    await waha.sendMessageWithTyping(null, user.whatsapp_phone!, TransactionsHandler.beautifyTransaction(transaction));
    const proximaCobranca = TransactionsHandler.dataProximaCobranca(transaction.data, recurringTransaction.frequencia);
    if (proximaCobranca) {
      await waha.sendMessageWithTyping(
        null,
        user.whatsapp_phone!,
        'A próxima cobrança será no dia: ' + new Date(proximaCobranca).toLocaleDateString('pt-BR'),
      );
    }
  },
);

export const POST = recurringTransactionQueue;
