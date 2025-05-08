import { capitalize } from 'lodash';
import OpenAI from 'openai';
import FunctionHandler from './base-handler';
import { recurringTransactionQueue } from '@/app/api/queues/recurring-transaction/route';

const GEMINI_API_KEY = 'AIzaSyDYapw143aCD_Lq8a0FWwjlJS7f_nArEYQ';

// 🧠 Prompt do agente para usuário não registrado:
const SYSTEM_PROMPT = `
Você é um assistente financeiro que interpreta mensagens informais (geralmente enviadas por WhatsApp) com o objetivo de registrar, atualizar ou cancelar transações financeiras do usuário.

Seu papel é identificar com clareza as intenções do usuário e chamar **uma das funções abaixo**, preenchendo todos os campos necessários com base na mensagem ou histórico recente da conversa:

- register_transaction
- update_transaction
- cancel_transaction
- update_recurring_transaction

Regras de comportamento:

0. **Nunca mande mensagens que confirmam ações**. Essas mensagens são SEMPRE enviadas pelas próprias funções. Chame a função quando uma ação deve ser realizada.
1. **Nunca pergunte o ID de uma transação**. Sempre recupere o ID do histórico de mensagens (por exemplo, da resposta da função register_transaction).
2. Antes de realizar qualquer **update**, envie uma **mensagem de confirmação amigável e clara**, dizendo ao usuário exatamente o que será alterado (ex: "Vou atualizar o valor da transação 5O18S19U para R$ 200,00. Confirma?").
3. Sempre assuma alguma categoria e data para a transação, mesmo que o usuário não tenha fornecido. Faça seu melhor chute.
4. Se o usuário disser algo como “cancela isso”, assuma que ele se refere à **última transação registrada**, e chame "cancel_transaction" com o ID correspondente.
5. Sempre que o usuário não informar a data da transação, use a data e hora atual: *${new Date().toISOString()}* e hoje é um dia de **${new Date().toLocaleDateString('pt-BR', { weekday: 'long' })}**.
6. Adapte a **descrição da transação** para torná-la mais legível, mesmo que o usuário tenha enviado algo abreviado, informal ou confuso.
7. Seja flexível: o usuário pode usar emojis, gírias ou linguagem cotidiana. Seu papel é interpretar corretamente.
8. Você pode separar o texto em várias mensagens para ficar mais natural e humano. Separe usando "•"

Seja objetivo, útil e mantenha sempre o foco em finanças pessoais.

---

### Exemplos de conversas

#### ✅ Exemplo 1 — Registro de despesa

**Usuário:** Almocei hoje, deu 42 reais  
→ Chamar "register_transaction"

---

#### ✅ Exemplo 2 — Registro de receita

**Usuário:** Recebi 500 de freelance  
→ Chamar "register_transaction"

---

#### ✅ Exemplo 3 — Atualização de valor

**Usuário:** aluguel de 500
**IA:** Transação de ID PJ0TTN4W registrada!

**Usuário:** Na verdade foram 550  
**IA:** Você quer atualizar o valor da transação PJ0TTN4W para R$ 550,00?•Mande "confirmar" para confirmar a atualização ou "cancelar" para cancelar.
**Usuário:** confirmar
→ Chamar "update_transaction" com ID da transação PJ0TTN4W

---

#### 
✅ Exemplo 4.1 — Cancelamento

**Usuário:** almoçei no mequi 37
**IA:** Transação de ID 5O18S19U registrada!
**Usuário:** cancela isso aí  
→ Chamar "cancel_transaction" com ID da transação 5O18S19U

✅ Exemplo 4.2 — Cancelamento

**Usuário:** jantei na nossa casa, 56
**IA:** Transação de ID NK2J3XKQ registrada!
**Usuário:** cancela
→ Chamar "cancel_transaction" com ID da transação NK2J3XKQ

✅ Exemplo 4.3 — Cancelamento

**Usuário:** cafe da manha na tia foi 22
**IA:** Transação de ID PJ0TTN4W registrada!
**Usuário:** cancela
→ Chamar "cancel_transaction" com ID da transação PJ0TTN4W

---

#### ✅ Exemplo 5 — Faltando dados

**Usuário:** Gastei 30 ontem  
**IA:** Pode me dizer o que foi esse gasto? Assim consigo classificar direitinho 😉  
**Usuário:** Almoço no mequi  
→ Chamar "register_transaction"

---
`;

const TOOLS: OpenAI.Responses.ResponseCreateParams['tools'] = [
  {
    type: 'function',
    name: 'register_transaction',
    description: 'Registra uma nova transação financeira do usuário, como uma despesa ou receita',
    strict: true,
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
    },
  },
  {
    type: 'function',
    name: 'update_transaction',
    description: 'Atualiza uma transação existente do usuário. O ID deve estar disponível no histórico da conversa.',
    strict: true,
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
    },
  },
  {
    type: 'function',
    name: 'update_recurring_transaction',
    description:
      'Atualiza uma transação recorrente existente do usuário. O ID deve estar disponível no histórico da conversa.',
    strict: true,
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
    },
  },
];

export default class TransactionsAgent {
  private messageHistory: OpenAI.Responses.ResponseInputItem[];

  constructor(messageHistory: OpenAI.Responses.ResponseInputItem[]) {
    this.messageHistory = [{ role: 'system', content: SYSTEM_PROMPT }, ...messageHistory];
  }

  async getResponse() {
    const body: OpenAI.Responses.ResponseCreateParams = {
      model: 'gemini-2.0-flash',
      input: this.messageHistory,
      tools: TOOLS,
      tool_choice: 'auto',
    };

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GEMINI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    const data: OpenAI.Responses.Response = await response.json();
    const output = data.output[0];

    if (output.type === 'function_call') {
      return {
        functionCalled: {
          ...output,
          handler: 'transactions',
          callback: (result: string) => {
            this.messageHistory.push(output);
            this.messageHistory.push({
              type: 'function_call_output',
              call_id: output.call_id,
              output: result,
            });
            return this.getResponse();
          },
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
  handleFunctionCall(functionCalled: { name: string; arguments: string }) {
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
        return false;
    }
  }
  // HANDLERS
  async registerTransaction(transaction: Transaction) {
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
      return false;
    }

    return registeredTransaction;
  }

  async registerRecurringTransaction(transaction: Transaction) {
    if (!transaction.frequencia) {
      console.error('Frequência is required');
      return false;
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
      return false;
    }

    // recurringTransactionQueue.enqueue(recurringTransaction, {
    //   id: String(recurringTransaction.id),
    //   runAt: firstChargeDate,
    //   repeat: {
    //     every: frequencias[transaction.frequencia as keyof typeof frequencias],
    //   },
    // });

    return recurringTransaction;
  }

  async updateRecurringTransaction(transaction: Partial<Transaction>) {
    if (!transaction.id) {
      console.error('Transaction ID is required');
      return false;
    }
    const { data: updatedTransaction, error } = await this.supabase
      .from('recurring_transactions')
      .update(transaction)
      .eq('id', transaction.id)
      .select()
      .single();

    if (!updatedTransaction) {
      console.error(error);
      return false;
    }

    return updatedTransaction;
  }

  async updateTransaction(transaction: Partial<Transaction>) {
    if (!transaction.id) {
      console.error('Transaction ID is required');
      return false;
    }

    const { data: updatedTransaction, error } = await this.supabase
      .from('transactions')
      .update(transaction)
      .eq('id', transaction.id)
      .select()
      .single();

    if (!updatedTransaction) {
      console.error(error);
      return false;
    }

    return updatedTransaction;
  }

  async cancelTransaction(id: string) {
    const { error } = await this.supabase.from('transactions').delete().eq('id', id);

    if (error) {
      console.error(error);
      return false;
    }

    return id;
  }
}
