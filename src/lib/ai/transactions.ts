import { capitalize } from 'lodash';
import OpenAI from 'openai';
import FunctionHandler from './base-handler';

const GEMINI_API_KEY = 'AIzaSyDYapw143aCD_Lq8a0FWwjlJS7f_nArEYQ';

// 🧠 Prompt do agente para usuário não registrado:
const SYSTEM_PROMPT = `
Você é um assistente financeiro especializado em entender mensagens informais (geralmente enviadas por WhatsApp) que descrevem transações financeiras do usuário. 
Seu objetivo é interpretar corretamente essas mensagens, extrair os dados relevantes e chamar a função apropriada com os parâmetros corretos.

Você pode realizar uma das seguintes ações:
- register_transaction: registrar uma nova transação (receita ou despesa)
- confirm_transaction_update: confirmar a atualização de uma transação já existente
- update_transaction: atualizar uma transação já existente
- cancel_transaction: cancelar uma transação registrada

Se faltar alguma informação essencial (como valor, data ou categoria), pergunte ao usuário de forma objetiva antes de executar qualquer função.

Regras importantes:
- Sempre que a data da transação não for especificada, use a data e hora atual: *${new Date().toISOString()}*.
- Nunca pergunte a data, sempre dê seu melhor chute.
- Nunca pergunte a categoria, sempre dê seu melhor chute.
- Nunca pergunte o ID da transação, sempre dê seu melhor chute baseado no histórico da conversa.
- Os usuários podem se expressar de forma informal, com abreviações, emojis ou linguagem cotidiana. Seja flexível e inteligente ao interpretar essas mensagens.
- A descrição da transação pode ser adaptada para torná-la mais legível e padronizada, com base no conteúdo da mensagem original.
- Apenas chame uma função se tiver segurança sobre os dados. Se algo estiver vago ou ambíguo, peça confirmação ao usuário.
`;

const TOOLS: OpenAI.Chat.ChatCompletionCreateParams['tools'] = [
  {
    type: 'function',
    function: {
      name: 'register_transaction',
      description: 'Registra uma nova transação financeira do usuário, como uma despesa ou receita',
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
            description: 'Indica se a transação se repete regularmente (ex: mensalmente).',
          },
        },
        required: ['tipo', 'valor', 'categoria', 'data', 'descricao', 'recorrente'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'confirm_transaction_update',
      description:
        'Confirma a atualização de uma transação existente do usuário. Busque o ID da transação no histórico da conversa ao invés de perguntar.',
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
          recorrente: {
            type: 'boolean',
            description: 'Se a recorrência foi alterada, indique aqui.',
          },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_transaction',
      description: 'Atualiza uma transação existente do usuário. O ID deve estar disponível no histórico da conversa.',
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
          recorrente: {
            type: 'boolean',
            description: 'Se a recorrência foi alterada, indique aqui.',
          },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_transaction',
      description: 'Cancela uma transação existente do usuário com base no ID registrado no histórico.',
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
  },
];

export default class TransactionsAgent {
  private messageHistory: OpenAI.Chat.ChatCompletionMessageParam[];

  constructor(messageHistory: OpenAI.Chat.ChatCompletionMessageParam[]) {
    this.messageHistory = messageHistory;
  }

  async getResponse() {
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...this.messageHistory];

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GEMINI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gemini-2.0-flash',
        messages,
        tools: TOOLS,
        tool_choice: 'auto',
      }),
    });
    const data: OpenAI.Chat.ChatCompletion = await response.json();
    const functionCalled = data.choices[0].message.tool_calls?.[0]?.function;
    const outputMessage = data.choices[0].message.content;

    if (functionCalled) {
      return { functionCalled: { ...functionCalled, handler: 'transactions' } };
    }

    return { functionCalled, outputMessage };
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
};

export class TransactionsHandler extends FunctionHandler {
  handleFunctionCall(functionCalled: { name: string; arguments: string }) {
    switch (functionCalled.name) {
      case 'register_transaction':
        return this.registerTransaction(JSON.parse(functionCalled.arguments));
      case 'update_transaction':
        return this.updateTransaction(JSON.parse(functionCalled.arguments));
      case 'cancel_transaction':
        return this.cancelTransaction(JSON.parse(functionCalled.arguments).id);
      case 'confirm_transaction_update':
        return this.confirmTransactionUpdate(JSON.parse(functionCalled.arguments));
      default:
        throw new Error('Invalid function name');
    }
  }
  // HANDLERS
  async registerTransaction(transaction: Transaction) {
    const { data: registeredTransaction } = await this.supabase
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
      throw new Error('Failed to register transaction');
    }

    const beautifiedTransaction = this.beautifyTransaction(registeredTransaction);
    await this.sendMessage(beautifiedTransaction);
  }

  async confirmTransactionUpdate(transaction: Partial<Transaction>) {
    if (!transaction.id) {
      throw new Error('Transaction ID is required');
    }

    const beautifiedTransaction = `
*Confirmação de atualização de transação*

ID: ${transaction.id}
${transaction.valor ? `Valor: *R$ ${transaction.valor.toFixed(2)}*` : ''}
${transaction.categoria ? `Categoria: *${capitalize(transaction.categoria)}*` : ''}
${transaction.data ? `Data: ${new Date(transaction.data).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}` : ''}
${transaction.descricao ? `Descrição: ${capitalize(transaction.descricao)}` : ''}

Mande "confirmar" para confirmar a atualização ou "cancelar" para cancelar.
    `;
    await this.sendMessage(beautifiedTransaction);
  }

  async updateTransaction(transaction: Partial<Transaction>) {
    if (!transaction.id) {
      throw new Error('Transaction ID is required');
    }

    const { data: updatedTransaction } = await this.supabase
      .from('transactions')
      .update(transaction)
      .eq('id', transaction.id)
      .select()
      .single();

    if (!updatedTransaction) {
      throw new Error('Failed to update transaction');
    }

    const beautifiedTransaction = this.beautifyTransaction(updatedTransaction, true);
    await this.sendMessage(beautifiedTransaction);
  }

  async cancelTransaction(id: string) {
    const { error } = await this.supabase.from('transactions').delete().eq('id', id);

    if (error) {
      console.error(error);
      throw new Error('Failed to cancel transaction');
    }

    await this.sendMessage('Transação cancelada com sucesso!');
  }

  beautifyTransaction(transaction: Partial<Transaction>, update = false) {
    return `
Transação ${update ? 'atualizada' : 'registrada'}! Confira os detalhes:

ID: ${transaction.id}
Valor: *R$ ${transaction.valor?.toFixed(2)}*
Categoria: *${capitalize(transaction.categoria)}*
Data: ${new Date(transaction?.data || new Date()).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}
Descrição: ${capitalize(transaction.descricao)}
    `.trim();
  }
}
