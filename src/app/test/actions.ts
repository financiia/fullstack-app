import ChatGPT from '@/lib/chatgpt';
import Waha from '@/lib/waha';
import { capitalize } from 'lodash';
// import { WhatsAppWebhookHandler } from '../api/waha-webhook/route';

export async function testGPT(userMessage: string) {
  const gpt = new ChatGPT();
  return gpt.getResponseREST(userMessage);
}

export async function testWaha(functionCalled: { name: string; arguments: string }) {
  const waha = new WahaController();
  // const cont = new WhatsAppWebhookHandler();
  // return cont.handleUnregisteredUser(null, '5521936181803@c.us');
  return waha.handleFunctionCall(functionCalled);
}

class WahaController {
  private waha: Waha;

  constructor() {
    this.waha = new Waha();
  }

  async handleFunctionCall(functionCalled: { name: string; arguments: string }) {
    switch (functionCalled.name) {
      case 'cancel_subscription':
        // return this.waha.sendMessageWithButtons(null, '5521936181803@c.us', [{ type: 'reply', text: 'Cancelar Plano' }], 'Você tem certeza que deseja cancelar o seu plano?', 'Se sim, clique no botão abaixo', 'A ação poderá ser desfeita até o dia 30/05');
        return this.waha.sendMessageWithTyping(
          null,
          '5521936181803@c.us',
          '*CANCELAMENTO DE ASSINATURA*\n\nVocê tem certeza que deseja cancelar o seu plano?\n\nSe sim, responda essa mensagem com "cancelar"',
        );
      case 'register_transaction':
        const transaction = JSON.parse(functionCalled.arguments);
        return this.waha.sendMessageWithTyping(null, '5521936181803@c.us', this.beautifyTransaction(transaction));
      case 'no_action':
        return this.waha.sendMessageWithTyping(
          null,
          '5521936181803@c.us',
          JSON.parse(functionCalled.arguments).message,
        );
      case 'explain_usage':
        return this.waha.sendMessageWithTyping(null, '5521936181803@c.us', this._explainUsageMessage());
      case 'get_last_transactions':
        const limit_days = JSON.parse(functionCalled.arguments).limit_days ?? 5;
        return this.waha.sendMessageWithTyping(
          null,
          '5521936181803@c.us',
          this._getLastTransactionsMessage(limit_days),
        );
      case 'monthly_spending_summary':
        return this.waha.sendMessageWithTyping(null, '5521936181803@c.us', this._getMonthlySpendingSummaryMessage());
      case 'spending_summary_30_days':
        return this.waha.sendMessageWithTyping(null, '5521936181803@c.us', this._getSpendingSummary30DaysMessage());
      case 'define_monthly_goal':
        const { tipo, valor } = JSON.parse(functionCalled.arguments);
        return this.waha.sendMessageWithTyping(null, '5521936181803@c.us', this._defineMonthlyGoalMessage(tipo, valor));
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

  _getLastTransactionsMessage(limit_days: number) {
    return `
Últimas transações:

Cheiro do pão dia 5 10 real
    `.trim();
  }

  _getMonthlySpendingSummaryMessage() {
    return `
Resumo do gasto do mês de *Maio (01/05 ~ 06/05)*:

Moradia: *R$ 250,00 (50%)*
Alimentação: *R$ 100,00 (20%)*
Outros: *R$ 100,00 (20%)*
Transporte: *R$ 50,00 (10%)*
    `.trim();
  }

  _getSpendingSummary30DaysMessage() {
    return `
Resumo do gasto dos últimos *30 dias (06/04 ~ 06/05)*:

Moradia: *R$ 200,00*
Alimentação: *R$ 100,00 (75% da meta mensal)*
Outros: *R$ 100,00 (20% da meta mensal)*
Transporte: *R$ 50,00*

Total: *R$ 450,00*
Meta mensal: *R$ 500,00*
    `.trim();
  }

  _defineMonthlyGoalMessage(tipo: string, valor: number) {
    return `
Meta mensal definida!

Agora sua meta mensal é de *R$ ${valor.toFixed(2)}* para a categoria *${capitalize(tipo)}*.
    `.trim();
  }
}
