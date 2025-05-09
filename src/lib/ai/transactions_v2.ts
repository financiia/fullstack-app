import { capitalize } from 'lodash';
import OpenAI from 'openai';
import FunctionHandler from './base-handler';
import { recurringTransactionQueue } from '@/app/api/queues/recurring-transaction/route';

// 🧠 Prompt do agente para usuário não registrado:
const SYSTEM_PROMPT = `
Você é um assistente financeiro que interpreta mensagens informais (geralmente enviadas por WhatsApp) com o objetivo de registrar, atualizar ou cancelar transações financeiras do usuário.

Seu papel é identificar com clareza as intenções do usuário e chamar **uma das funções abaixo**, preenchendo todos os campos necessários com base na mensagem ou histórico recente da conversa:

- register_transaction
- update_transaction
- cancel_transaction
- update_recurring_transaction

As categorias disponíveis são: "alimentação", "transporte", "moradia", "saúde", "lazer", "outros".

Regras de comportamento:

1. **Nunca pergunte o ID de uma transação**. Sempre recupere o ID do histórico de mensagens (por exemplo, da resposta da função register_transaction).
2. Sempre assuma alguma categoria e data para o registro de uma transação, mesmo que o usuário não tenha fornecido. *Faça seu melhor chute*.
3. Se o usuário disser algo como “cancela isso”, assuma que ele se refere à **última transação registrada**, e chame "cancel_transaction" com o ID correspondente.
4. Sempre que o usuário não informar a data da transação, use a data e hora atual.
5. Adapte a **descrição da transação** para torná-la mais legível, mesmo que o usuário tenha enviado algo abreviado, informal ou confuso.
6. Seja flexível: o usuário pode usar emojis, gírias ou linguagem cotidiana. Seu papel é interpretar corretamente.

Seja objetivo, útil e mantenha sempre o foco em finanças pessoais.

---

### Exemplos de conversas

#### ✅ Exemplo 1 — Registro de despesa

- Usuário: Almocei hoje, deu 42 reais  
- IA: → Chamar "register_transaction"
- IA:
Transação registrada! Confira os detalhes:

*#5O18S19U*
Valor: *R$ 42.00*
Categoria: *Alimentação*
Data: 08/05/2025, 13:38
Descrição: Almoço

---

#### ✅ Exemplo 3 — Atualização de valor

- Usuário: fatura da internet de 99
- IA: → Chamar "register_transaction"
- IA: 
Transação registrada! Confira os detalhes:

*#A2PJU*
Valor: *R$ 99.00*
Categoria: *Moradia*
Data: 08/05/2025, 13:38
Descrição: Pagamento da fatura de internet

- Usuário: Na verdade foi 115
- IA: → Chamar "update_transaction" com ID da transação #A2PJU
- IA:
Transação atualizada! Confira os detalhes:

*#A2PJU*
Valor: *R$ 115.00*
Categoria: *Moradia*
Data: 08/05/2025, 13:38
Descrição: Pagamento da fatura de internet

---

#### 
✅ Exemplo 4.1 — Cancelamento

- Usuário: almoçei no mequi 37
- IA: → Chamar "register_transaction"
- IA: 
Transação registrada! Confira os detalhes:

*#5O18S19U*
Valor: *R$ 37.00*
Categoria: *Alimentação*
Data: 08/05/2025, 13:38
Descrição: Almoço no mequi

- Usuário: cancela isso aí  
- IA: → Chamar "cancel_transaction" com ID da transação #5O18S19U
- IA: Prontinho! Cancelei a transação *#5O18S19U* pra você.

---

#### ✅ Exemplo 5 — Faltando dados

Usuário: Gastei 30 ontem  
IA: Pode me dizer o que foi esse gasto? Assim consigo classificar direitinho 😉  
Usuário: Almoço no mequi  
→ Chamar "register_transaction"

---

A data atual é *${new Date().toISOString()}* e hoje é um dia de **${new Date().toLocaleDateString('pt-BR', { weekday: 'long' })}**.
`;

const TOOLS: OpenAI.Responses.ResponseCreateParams['tools'] = [
  {
    type: 'function',
    name: 'register_transaction',
    description: 'Registra uma nova transação financeira do usuário, como uma despesa ou receita',
    strict: false,
    parameters: {
      type: 'object',
      properties: {
        tipo: {
          type: 'string',
          description: 'Tipo da transação. Pode ser "despesa" (saída de dinheiro) ou "receita" (entrada de dinheiro)',
          enum: ['despesa', 'receita'],
        },
        valor: {
          type: 'number',
          description: 'Valor numérico da transação. Não use símbolos como R$ ou vírgulas.',
        },
        categoria: {
          type: 'string',
          description:
            'Categoria da transação. Deve ser uma entre: "alimentação", "transporte", "moradia", "saúde", "lazer", "outros".',
          enum: ['alimentação', 'transporte', 'moradia', 'saúde', 'lazer', 'outros'],
        },
        data: {
          type: 'string',
          description:
            'Data da transação no formato ISO 8601 (ex: 2025-05-07T14:30:00Z). Use a data atual se nenhuma data for fornecida.',
        },
        descricao: {
          type: 'string',
          description: 'Descrição curta e clara da transação. Pode ser reescrita a partir da mensagem do usuário.',
        },
        recorrente: {
          type: 'boolean',
          description:
            'Indica se a transação se repete regularmente (ex: mensalmente). Se true, DEVE ser informado o campo "frequencia" e "primeira_cobranca".',
        },
        frequencia: {
          type: 'string',
          description: 'Frequência de recorrência da transação. Pode ser "diária", "semanal", "mensal" ou "anual".',
          enum: ['diária', 'semanal', 'mensal', 'anual'],
        },
        primeira_cobranca: {
          type: 'string',
          description:
            'Data da primeira cobrança da transação recorrente. Deve ser no formato ISOString. Se o usuário não informar, use a hora atual. Se a data for no passado, coloque a data da próxima cobrança.',
        },
      },
      required: ['tipo', 'valor', 'categoria', 'data', 'descricao', 'recorrente'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'update_transaction',
    description: 'Atualiza uma transação existente do usuário. O ID deve estar disponível no histórico da conversa.',
    strict: false,
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID da transação a ser atualizada. Deve ser obtido a partir do histórico.',
        },
        tipo: {
          type: 'string',
          description: 'Tipo atualizado da transação, se for o caso. Pode ser "despesa" ou "receita".',
          enum: ['despesa', 'receita'],
        },
        valor: {
          type: 'number',
          description: 'Valor atualizado da transação.',
        },
        categoria: {
          type: 'string',
          description:
            'Categoria atualizada. Deve ser uma entre: "alimentação", "transporte", "moradia", "saúde", "lazer", "outros".',
          enum: ['alimentação', 'transporte', 'moradia', 'saúde', 'lazer', 'outros'],
        },
        data: {
          type: 'string',
          description: 'Nova data da transação no formato ISO 8601, se for atualizada.',
        },
        descricao: {
          type: 'string',
          description: 'Nova descrição da transação.',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'cancel_transaction',
    description: 'Cancela uma transação existente do usuário com base no ID registrado no histórico.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID da transação a ser cancelada. Deve estar disponível no histórico da conversa.',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'update_recurring_transaction',
    description:
      'Atualiza uma transação recorrente existente do usuário. O ID deve estar disponível no histórico da conversa.',
    strict: false,
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'ID da transação recorrente a ser atualizada. Deve estar disponível no histórico da conversa.',
        },
        valor: {
          type: 'number',
          description: 'Valor atualizado da transação.',
        },
        categoria: {
          type: 'string',
          description: 'Categoria atualizada.',
          enum: ['alimentação', 'transporte', 'moradia', 'saúde', 'lazer', 'outros'],
        },
        data: {
          type: 'string',
          description: 'Nova data da transação no formato ISO 8601, se for atualizada.',
        },
        descricao: {
          type: 'string',
          description: 'Nova descrição da transação.',
        },
        frequencia: {
          type: 'string',
          description: 'Frequência de recorrência da transação. Pode ser "diária", "semanal", "mensal" ou "anual".',
          enum: ['diária', 'semanal', 'mensal', 'anual'],
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
];

const client = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY,
});

export default class TransactionsAgent {
  private messageHistory: OpenAI.Responses.ResponseInputItem[];

  constructor(messageHistory: OpenAI.Responses.ResponseInputItem[]) {
    this.messageHistory = [{ role: 'system', content: SYSTEM_PROMPT }, ...messageHistory];
  }

  async getResponse(serverHandler: FunctionHandler, tokens = 0) {
    const body: OpenAI.Responses.ResponseCreateParams = {
      model: 'gpt-4.1-nano',
      input: this.messageHistory,
      tools: TOOLS,
      tool_choice: 'auto',
    };

    const response = await client.responses.create(body);
    tokens += response.usage?.total_tokens ?? 0;
    const output = response.output[0];

    if (output.type === 'function_call') {
      const transactionsHandler = new TransactionsHandler(serverHandler);
      await transactionsHandler.handleFunctionCall(output);
    }
    if (output.type === 'message' && output.content[0].type === 'output_text') {
      await serverHandler.sendMessage(output.content[0].text);
    }

    return tokens;
  }
}

type Transaction = {
  id?: string;
  tipo: string;
  valor: number;
  categoria: string;
  data: string;
  descricao: string;
  recorrente: boolean;
  frequencia?: string;
  primeira_cobranca?: string;
};

const DAY_IN_MS = 1000 * 60 * 60 * 24;
const frequencias = {
  diária: DAY_IN_MS,
  semanal: DAY_IN_MS * 7,
  mensal: DAY_IN_MS * 30,
  anual: DAY_IN_MS * 365,
};

export class TransactionsHandler {
  constructor(private serverHandler: FunctionHandler) {}

  handleFunctionCall(functionCalled: { name: string; arguments: string }) {
    const parsedArguments = JSON.parse(functionCalled.arguments);
    // Tira o # da frente do ID, caso a IA tenha colocado
    if (parsedArguments.id && parsedArguments.id.startsWith('#')) {
      parsedArguments.id = parsedArguments.id.slice(1);
    }

    switch (functionCalled.name) {
      case 'register_transaction':
        if (parsedArguments.recorrente) {
          return this.registerRecurringTransaction(parsedArguments);
        }
        return this.registerTransaction(parsedArguments);
      case 'update_transaction':
        return this.updateTransaction(parsedArguments);
      case 'update_recurring_transaction':
        return this.updateRecurringTransaction(parsedArguments);
      case 'cancel_transaction':
        return this.cancelTransaction(parsedArguments.id);
      default:
        throw new Error('Invalid function name');
    }
  }
  // HANDLERS
  async registerTransaction(transaction: Transaction) {
    this.logger('Registering transaction', 'info');
    const { data: registeredTransaction, error } = await this.serverHandler.supabase
      .from('transactions')
      .insert({
        user_id: this.serverHandler.user!.id,
        categoria: transaction.categoria,
        valor: transaction.valor,
        data: transaction.data,
        descricao: transaction.descricao,
      })
      .select()
      .single();

    if (!registeredTransaction) {
      await this.serverHandler.sendMessage(
        'Não foi possível registrar a transação. Tente novamente mais tarde ou entre em contato com o suporte.',
      );
      return this.logger(error.message, 'error');
      // throw new Error('Failed to register transaction');
    }

    const beautifiedTransaction = TransactionsHandler.beautifyTransaction(registeredTransaction);
    await this.serverHandler.sendMessage(beautifiedTransaction);
  }

  async registerRecurringTransaction(transaction: Transaction) {
    this.logger('Registering recurring transaction', 'info');
    if (!transaction.frequencia) {
      throw new Error('Frequência is required');
    }
    const { data: recurringTransaction, error } = await this.serverHandler.supabase
      .from('recurring_transactions')
      .insert({
        user_id: this.serverHandler.user!.id,
        categoria: transaction.categoria,
        valor: transaction.valor,
        descricao: transaction.descricao,
        frequencia: transaction.frequencia,
      })
      .select()
      .single();

    if (!recurringTransaction) {
      await this.serverHandler.sendMessage(
        'Não foi possível registrar a transação recorrente. Tente novamente mais tarde ou entre em contato com o suporte.',
      );
      return this.logger(error.message, 'error');
    }

    const firstChargeDate = TransactionsHandler.dataPrimeiraCobranca(
      transaction.primeira_cobranca,
      transaction.frequencia,
    );

    recurringTransactionQueue.enqueue(recurringTransaction, {
      id: String(recurringTransaction.id),
      runAt: firstChargeDate,
      repeat: {
        every: frequencias[transaction.frequencia as keyof typeof frequencias],
      },
    });

    await this.serverHandler.sendMessage(TransactionsHandler.beautifyRecurringTransaction(recurringTransaction));
  }

  async updateRecurringTransaction(transaction: Partial<Transaction>) {
    this.logger('Updating recurring transaction #' + transaction.id, 'info');
    if (!transaction.id) {
      this.logger('Transaction ID is required', 'error');
      await this.serverHandler.sendMessage(
        'Não foi possível atualizar a transação. Tente novamente mais tarde ou entre em contato com o suporte.',
      );
      return;
    }
    const { data: updatedTransaction, error } = await this.serverHandler.supabase
      .from('recurring_transactions')
      .update(transaction)
      .eq('id', transaction.id)
      .select()
      .single();

    if (!updatedTransaction) {
      await this.serverHandler.sendMessage(
        'Não foi possível atualizar a transação. Tente novamente mais tarde ou entre em contato com o suporte.',
      );
      return this.logger(error.message, 'error');
    }

    await this.serverHandler.sendMessage(TransactionsHandler.beautifyRecurringTransaction(updatedTransaction, true));
  }

  async updateTransaction(transaction: Partial<Transaction>) {
    this.logger('Updating transaction #' + transaction.id, 'info');
    if (!transaction.id) {
      this.logger('Transaction ID is required', 'error');
      throw new Error('Transaction ID is required');
    }

    const { data: updatedTransaction, error } = await this.serverHandler.supabase
      .from('transactions')
      .update(transaction)
      .eq('id', transaction.id)
      .select()
      .single();

    if (!updatedTransaction) {
      await this.serverHandler.sendMessage(
        'Não foi possível atualizar a transação. Tente novamente mais tarde ou entre em contato com o suporte.',
      );
      console.log(transaction);
      return this.logger(error.message, 'error');
    }

    const beautifiedTransaction = TransactionsHandler.beautifyTransaction(updatedTransaction, true);
    await this.serverHandler.sendMessage(beautifiedTransaction);
  }

  async cancelTransaction(id: string) {
    this.logger('Cancelling transaction #' + id, 'info');
    const { error } = await this.serverHandler.supabase.from('transactions').delete().eq('id', id);

    if (error) {
      await this.serverHandler.sendMessage(
        'Não foi possível cancelar a transação. Tente novamente mais tarde ou entre em contato com o suporte.',
      );
      return this.logger(error.message, 'error');
    }

    await this.serverHandler.sendMessage(`Transação #${id} cancelada com sucesso!`);
  }

  static beautifyTransaction(transaction: Partial<Transaction>, update = false) {
    return `
Transação ${update ? 'atualizada' : 'registrada'}! Confira os detalhes:

*#${transaction.id}*
Valor: *R$ ${transaction.valor?.toFixed(2)}*
Categoria: *${capitalize(transaction.categoria)}*
Data: ${new Date(transaction?.data || new Date()).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}
Descrição: ${capitalize(transaction.descricao)}
    `.trim();
  }

  static beautifyRecurringTransaction(transaction: Partial<Transaction>, update = false) {
    const firstChargeDate = transaction.primeira_cobranca
      ? new Date(transaction.primeira_cobranca).toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          dateStyle: 'short',
          timeStyle: 'short',
        })
      : 'Agora';

    return `
Transação recorrente ${update ? 'atualizada' : 'registrada'}! Confira os detalhes:

*#${transaction.id}*
Valor: *R$ ${transaction.valor?.toFixed(2)}*
Categoria: *${capitalize(transaction.categoria)}*
Descrição: ${capitalize(transaction.descricao)}
Frequência: *${capitalize(transaction.frequencia)}*
Data da primeira cobrança: ${firstChargeDate}
    `.trim();
  }

  static dataPrimeiraCobranca(date: string | undefined, frequencia: string) {
    if (!date) {
      return undefined;
    }

    // Se a frequência não for diária, coloca a hora pra 15h
    const firstChargeDate = new Date(frequencia === 'diária' ? date : date.split('T')[0] + 'T15:00:00Z');

    if (firstChargeDate > new Date()) {
      return firstChargeDate;
    }

    // Se for um momento muito próximo (menos que 1min), retorna undefined
    if (Math.abs(firstChargeDate.getTime() - new Date().getTime()) < 1000 * 60) {
      return undefined;
    }

    // Aumenta pelo tempo de recorrência até achar uma data futura
    while (firstChargeDate < new Date()) {
      if (frequencia === 'diária' || frequencia === 'semanal') {
        firstChargeDate.setTime(firstChargeDate.getTime() + frequencias[frequencia as keyof typeof frequencias]);
      } else if (frequencia === 'mensal') {
        firstChargeDate.setMonth(firstChargeDate.getMonth() + 1);
      } else if (frequencia === 'anual') {
        firstChargeDate.setFullYear(firstChargeDate.getFullYear() + 1);
      }
    }

    return firstChargeDate;
  }

  static dataProximaCobranca(date: string, frequencia: string) {
    const firstChargeDate = new Date(date);
    if (frequencia === 'diária' || frequencia === 'semanal') {
      firstChargeDate.setTime(firstChargeDate.getTime() + frequencias[frequencia as keyof typeof frequencias]);
    } else if (frequencia === 'mensal') {
      firstChargeDate.setMonth(firstChargeDate.getMonth() + 1);
    } else if (frequencia === 'anual') {
      firstChargeDate.setFullYear(firstChargeDate.getFullYear() + 1);
    }

    return firstChargeDate;
  }

  logger(message: string, level: 'log' | 'info' | 'error' = 'log') {
    console[level]('\x1b[34m TRANSACTIONS HANDLER: \x1b[0m ', message);
  }
}
