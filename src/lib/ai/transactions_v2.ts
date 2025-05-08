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
2. Antes de realizar qualquer **update**, envie uma **mensagem de confirmação amigável e clara**, dizendo ao usuário exatamente o que será alterado (ex: "Vou atualizar o valor da transação 5O18S19U para R$ 200,00. Confirma?").
3. Sempre assuma alguma categoria e data para o registro de uma transação, mesmo que o usuário não tenha fornecido. *Faça seu melhor chute*.
4. Se o usuário disser algo como “cancela isso”, assuma que ele se refere à **última transação registrada**, e chame "cancel_transaction" com o ID correspondente.
5. Sempre que o usuário não informar a data da transação, use a data e hora atual.
A data atual é *${new Date().toISOString()}* e hoje é um dia de **${new Date().toLocaleDateString('pt-BR', { weekday: 'long' })}**.
6. Adapte a **descrição da transação** para torná-la mais legível, mesmo que o usuário tenha enviado algo abreviado, informal ou confuso.
7. Seja flexível: o usuário pode usar emojis, gírias ou linguagem cotidiana. Seu papel é interpretar corretamente.
8. Você pode separar o texto em várias mensagens para ficar mais natural e humano. Separe usando "•"
9. Ao fazer uma operação de registro ou atualização, sempre entregue no final a mensagem completa com todos os detalhes da transação, especialmente o ID.
A FORMATAÇÃO DO OUTPUT DE REGISTRO E ATUALIZAÇÃO SEMPRE DEVE SEGUIR ESTE PADRÃO:
\`
Transação registrada! Confira os detalhes:

*#5O18S19U*
Valor: *R$ 42.00*
Categoria: *Alimentação*
Data: 08/05/2025, 13:38
Descrição: Almoço
\`

Seja objetivo, útil e mantenha sempre o foco em finanças pessoais.

---

### Exemplos de conversas

#### ✅ Exemplo 1 — Registro de despesa

Usuário: Almocei hoje, deu 42 reais  
→ Chamar "register_transaction"
IA:
Transação registrada! Confira os detalhes:

*#5O18S19U*
Valor: *R$ 42.00*
Categoria: *Alimentação*
Data: 08/05/2025, 13:38
Descrição: Almoço

---

#### ✅ Exemplo 3 — Atualização de valor

Usuário: fatura da internet de 99
→ Chamar "register_transaction"
IA: 
Transação registrada! Confira os detalhes:

*#A2PJU*
Valor: *R$ 99.00*
Categoria: *Moradia*
Data: 08/05/2025, 13:38
Descrição: Pagamento da fatura de internet

Usuário: Na verdade foi 115  
IA: Você quer atualizar o valor da transação #A2PJU para R$ 115,00?•Mande "confirmar" para confirmar a atualização ou "cancelar" para cancelar.
Usuário: confirmar
→ Chamar "update_transaction" com ID da transação #A2PJU
IA:
Transação atualizada! Confira os detalhes:

*#A2PJU*
Valor: *R$ 115.00*
Categoria: *Moradia*
Data: 08/05/2025, 13:38
Descrição: Pagamento da fatura de internet

---

#### 
✅ Exemplo 4.1 — Cancelamento

Usuário: almoçei no mequi 37
→ Chamar "register_transaction"
IA: 
Transação registrada! Confira os detalhes:

*#5O18S19U*
Valor: *R$ 37.00*
Categoria: *Alimentação*
Data: 08/05/2025, 13:38
Descrição: Almoço no mequi
Usuário: cancela isso aí  
→ Chamar "cancel_transaction" com ID da transação #5O18S19U
IA: Prontinho! Cancelei a transação *#5O18S19U* pra você.

---

#### ✅ Exemplo 5 — Faltando dados

Usuário: Gastei 30 ontem  
IA: Pode me dizer o que foi esse gasto? Assim consigo classificar direitinho 😉  
Usuário: Almoço no mequi  
→ Chamar "register_transaction"
IA:
Transação registrada! Confira os detalhes:

*#5O18S19U*
Valor: *R$ 30.00*
Categoria: *Alimentação*
Data: 08/05/2025, 13:38
Descrição: Almoço no mequi

---
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
      return {
        ...output,
        handler: 'transactions',
        callback: (result: string) => {
          this.messageHistory.push(output);
          this.messageHistory.push({
            type: 'function_call_output',
            call_id: output.call_id,
            output: result,
          });
          return this.getResponse(tokens);
        },
      };
    }

    return output;
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

export class TransactionsHandler extends FunctionHandler {
  handleFunctionCall(functionCalled: { name: string; arguments: string }): Promise<string> {
    switch (functionCalled.name) {
      case 'register_transaction':
        if (JSON.parse(functionCalled.arguments).recorrente) {
          return this.registerRecurringTransaction(JSON.parse(functionCalled.arguments));
        }
        return this.registerTransaction(JSON.parse(functionCalled.arguments));
      case 'update_transaction':
        return this.updateTransaction(JSON.parse(functionCalled.arguments));
      case 'update_recurring_transaction':
        return this.updateRecurringTransaction(JSON.parse(functionCalled.arguments));
      case 'cancel_transaction':
        return this.cancelTransaction(JSON.parse(functionCalled.arguments).id);
      default:
        return Promise.resolve('Function not found');
    }
  }
  // HANDLERS
  async registerTransaction(transaction: Transaction): Promise<string> {
    const { data: registeredTransaction, error } = await this.supabase
      .from('transactions')
      .insert({
        user_id: this.user!.id,
        categoria: transaction.categoria,
        valor: transaction.valor,
        data: transaction.data,
        descricao: transaction.descricao,
      })
      .select()
      .single();

    if (!registeredTransaction) {
      console.error(error);
      return 'failure';
    }

    return JSON.stringify(registeredTransaction);
  }

  async registerRecurringTransaction(transaction: Transaction): Promise<string> {
    if (!transaction.frequencia) {
      console.error('Frequência is required');
      return 'failure';
    }
    const { data: recurringTransaction, error } = await this.supabase
      .from('recurring_transactions')
      .insert({
        user_id: this.user!.id,
        categoria: transaction.categoria,
        valor: transaction.valor,
        descricao: transaction.descricao,
        frequencia: transaction.frequencia,
      })
      .select()
      .single();

    if (!recurringTransaction) {
      console.error(error);
      return 'failure';
    }

    // recurringTransactionQueue.enqueue(recurringTransaction, {
    //   id: String(recurringTransaction.id),
    //   runAt: firstChargeDate,
    //   repeat: {
    //     every: frequencias[transaction.frequencia as keyof typeof frequencias],
    //   },
    // });

    return JSON.stringify(recurringTransaction);
  }

  async updateRecurringTransaction(transaction: Partial<Transaction>): Promise<string> {
    if (!transaction.id) {
      console.error('Transaction ID is required');
      return 'failure';
    }
    const { data: updatedTransaction, error } = await this.supabase
      .from('recurring_transactions')
      .update(transaction)
      .eq('id', transaction.id)
      .select()
      .single();

    if (!updatedTransaction) {
      console.error(error);
      return 'failure';
    }

    return JSON.stringify(updatedTransaction);
  }

  async updateTransaction(transaction: Partial<Transaction>): Promise<string> {
    if (!transaction.id) {
      console.error('Transaction ID is required');
      return 'failure';
    }

    const { data: updatedTransaction, error } = await this.supabase
      .from('transactions')
      .update(transaction)
      .eq('id', transaction.id)
      .select()
      .single();

    if (!updatedTransaction) {
      console.error(error);
      return 'failure';
    }

    return JSON.stringify(updatedTransaction);
  }

  async cancelTransaction(id: string): Promise<string> {
    const { error } = await this.supabase.from('transactions').delete().eq('id', id);

    if (error) {
      console.error(error);
      return 'failure';
    }

    return 'success';
  }
}
