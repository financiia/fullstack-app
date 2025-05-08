import { capitalize } from 'lodash';
import OpenAI from 'openai';
import FunctionHandler from './base-handler';

const GEMINI_API_KEY = 'AIzaSyDYapw143aCD_Lq8a0FWwjlJS7f_nArEYQ';

// 🧠 Prompt do agente para usuário não registrado:
const SYSTEM_PROMPT = `
Você é um assistente financeiro responsável por gerenciar metas mensais de gasto do usuário.

Seu trabalho é entender mensagens informais e identificar com clareza quando o usuário deseja criar, atualizar ou cancelar uma meta de gasto para uma categoria específica.

Você deve sempre chamar **uma das funções abaixo**, preenchendo todos os campos necessários com base na mensagem ou no histórico recente da conversa:

- upsert_goal
- cancel_goal
- create_category
- rename_category
- delete_category

As categories atualmente cadastradas para esse usuário são:
- Carro
- Gasolina
- Gastos fixos
- Alimentação
- Lazer
- Transporte
- Saúde
- Comer fora
- Pets
- Outros

Regras de comportamento:

1. Antes de realizar qualquer **update**, envie uma **mensagem de confirmação clara e objetiva**, como: "Certo! Vou atualizar sua meta da categoria alimentação para R$ 600,00. Confirma?"
2. Os valores devem sempre ser tratados como números (sem o símbolo "R$").
3. As categorias são definidas pelo próprio usuário. Se ele mencionar uma categoria nova, você deve chamá-la de forma padronizada (ex: tudo minúsculo) e criar automaticamente com \`create_category\`, caso necessário.
4. Se o usuário quiser mudar o nome de uma categoria ou deletar uma categoria existente, use \`rename_category\` ou \`delete_category\`.
5. Se faltar algum dado importante (ex: valor da meta), pergunte de forma direta e breve.
6. Use linguagem clara, simples e objetiva, mantendo sempre o foco em ajudar o usuário a controlar seus gastos por categoria.

---

### Exemplos de conversas

#### ✅ Exemplo 1 — Registro de meta

**Usuário:** quero gastar no máximo 500 com alimentação esse mês  
**IA:** Entendido! Vou registrar uma meta de R$ 500,00 para a categoria "alimentação" neste mês.  
→ Chamar \`upsert_goal\`

---

#### ✅ Exemplo 2 — Atualização de valor

**Usuário:** pode aumentar pra 600  
**IA:** Ok! Atualizando sua meta da categoria "alimentação" para R$ 600,00.  
→ Chamar \`upsert_goal\`

---

#### ✅ Exemplo 3 — Cancelamento de meta

**Usuário:** cancela essa meta de lazer  
**IA:** Tudo bem, cancelando a meta da categoria "lazer".  
→ Chamar \`cancel_goal\`

---

#### ✅ Exemplo 4 — Nova categoria

**Usuário:** quero gastar até 300 com pets  
**IA:** Ótimo! Criando a categoria "pets" e registrando a meta de R$ 300,00.  
→ Chamar \`create_category\` → depois \`register_goal\`

---

#### ✅ Exemplo 5 — Renomear categoria

**Usuário:** troca "carro" por "transporte"  
**IA:** Claro! Renomeando a categoria "carro" para "transporte".  
→ Chamar \`rename_category\`

---
`;

const TOOLS: OpenAI.Chat.ChatCompletionCreateParams['tools'] = [
  {
    type: 'function',
    function: {
      name: 'register_goal',
      description: 'Registra uma nova meta de gasto para uma categoria no mês especificado (ou mês atual)',
      parameters: {
        type: 'object',
        properties: {
          categoria: {
            type: 'string',
            description: 'Nome da categoria da meta, como "alimentação", "lazer", etc.',
          },
          valor: {
            type: 'number',
            description: 'Valor máximo permitido de gasto para a categoria (em reais, sem símbolo)',
          },
          mes: {
            type: 'string',
            description: 'Mês da meta no formato ISO (ex: "2025-05-01"). Se não for informado, usar o mês atual.',
          },
        },
        required: ['categoria', 'valor'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_goal',
      description: 'Atualiza o valor de uma meta existente para uma categoria',
      parameters: {
        type: 'object',
        properties: {
          categoria: {
            type: 'string',
            description: 'Nome da categoria da meta que será atualizada',
          },
          novo_valor: {
            type: 'number',
            description: 'Novo valor da meta (em reais)',
          },
          mes: {
            type: 'string',
            description: 'Mês da meta no formato ISO (opcional — se não informado, assume mês atual)',
          },
        },
        required: ['categoria', 'novo_valor'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_goal',
      description: 'Cancela uma meta de gasto para uma categoria',
      parameters: {
        type: 'object',
        properties: {
          categoria: {
            type: 'string',
            description: 'Nome da categoria cuja meta será cancelada',
          },
          mes: {
            type: 'string',
            description: 'Mês da meta no formato ISO (opcional — se não informado, assume mês atual)',
          },
        },
        required: ['categoria'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_category',
      description: 'Cria uma nova categoria personalizada para o usuário',
      parameters: {
        type: 'object',
        properties: {
          nome: {
            type: 'string',
            description: 'Nome da nova categoria, como "pets", "faculdade", etc.',
          },
        },
        required: ['nome'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'rename_category',
      description: 'Renomeia uma categoria existente para um novo nome',
      parameters: {
        type: 'object',
        properties: {
          antigo_nome: {
            type: 'string',
            description: 'Nome atual da categoria',
          },
          novo_nome: {
            type: 'string',
            description: 'Novo nome desejado para a categoria',
          },
        },
        required: ['antigo_nome', 'novo_nome'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_category',
      description: 'Deleta uma categoria personalizada (e todas as metas associadas, se houver)',
      parameters: {
        type: 'object',
        properties: {
          nome: {
            type: 'string',
            description: 'Nome da categoria a ser removida',
          },
        },
        required: ['nome'],
      },
    },
  },
];

export default class GoalsAgent {
  private messageHistory: OpenAI.Chat.ChatCompletionMessageParam[];

  constructor(messageHistory: OpenAI.Chat.ChatCompletionMessageParam[]) {
    this.messageHistory = messageHistory;
  }

  async getResponse() {
    const messageHistory = await Promise.all(
      this.messageHistory.map(async (message) => {
        if ((message.content as string).includes('Transação registrada! Confira os detalhes:')) {
          const transactionId = (message.content as string).match(/ID: ([A-Z0-9]+)/)?.[1];
          message.content = `Despesa de ID ${transactionId} registrada!`;
        }
        return message;
      }),
    );
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...messageHistory];

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

export class GoalsHandler extends FunctionHandler {
  handleFunctionCall(functionCalled: { name: string; arguments: string }) {
    switch (functionCalled.name) {
      case 'register_transaction':
        return this.registerTransaction(JSON.parse(functionCalled.arguments));
      case 'update_transaction':
        return this.updateTransaction(JSON.parse(functionCalled.arguments));
      case 'cancel_transaction':
        return this.cancelTransaction(JSON.parse(functionCalled.arguments).id);
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
      await this.sendMessage(
        'Não foi possível registrar a transação. Tente novamente mais tarde ou entre em contato com o suporte.',
      );
      throw new Error('Failed to register transaction');
    }

    const beautifiedTransaction = this.beautifyTransaction(registeredTransaction);
    await this.sendMessage(beautifiedTransaction);
    // await this.waha.sendMessageWithButtons(
    //   beautifiedTransaction,
    //   this.payload.from,
    //   [
    //     { type: 'copy', text: 'Copiar ID', copyCode: registeredTransaction.id },
    //   ]
    // );
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
      await this.sendMessage(
        'Não foi possível atualizar a transação. Tente novamente mais tarde ou entre em contato com o suporte.',
      );
      throw new Error('Failed to update transaction');
    }

    const beautifiedTransaction = this.beautifyTransaction(updatedTransaction, true);
    await this.sendMessage(beautifiedTransaction);
  }

  async cancelTransaction(id: string) {
    const { error } = await this.supabase.from('transactions').delete().eq('id', id);

    if (error) {
      await this.sendMessage(
        'Não foi possível cancelar a transação. Tente novamente mais tarde ou entre em contato com o suporte.',
      );
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
