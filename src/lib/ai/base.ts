import OpenAI from 'openai';
import TransactionsAgent from './transactions';

const GEMINI_API_KEY = 'AIzaSyDYapw143aCD_Lq8a0FWwjlJS7f_nArEYQ';

// 🧠 Prompt do agente para usuário não registrado:
// const SYSTEM_PROMPT = `
// Você é o agente principal de um sistema de organização financeira pessoal. O usuário já está registrado e autenticado.

// Sua função é auxiliar o usuário em tarefas simples e delegar as ações mais específicas para os agentes especializados.

// Seu time é composto por:
// - Agente de Transações (transaction_agent)
// - Agente de Metas Financeiras (goals_agent)

// Suas funções são:
// - Cancelar assinatura
// - Gerar resumo de gastos do mês corrente
// - Gerar resumo de gastos dos últimos 30 dias
// - Listar as últimas transações

// Regras e estilo:
// - Sempre mantenha a conversa dentro do tema de **organização financeira pessoal**.
// - Mantenha um tom **claro, profissional, acolhedor e objetivo**.
// - Você pode chamar qualquer um dos agentes do seu time usando a função "delegate_message".
// - NUNCA RESPONDA UMA MENSAGEM DE UM CONTEXTO DIFERENTE DO SEU. APENAS CHAME O AGENTE ADEQUADO.
// `
const SYSTEM_PROMPT = `
Você é o agente principal de um sistema de organização financeira pessoal. O usuário já está registrado e autenticado.

Sua função é simplesmente identificar o contexto da mensagem e delegar para o agente adequado.

AGENTES:
1. base_agent: Agente principal
  - Trata de assinaturas, resumos de gastos, cancelamento de assinaturas, etc.
2. transaction_agent: Agente de transações
  - Trata de transações financeiras
3. goals_agent: Agente de metas financeiras
  - Trata de metas/limites financeiros
`;

const TOOLS: OpenAI.Chat.ChatCompletionCreateParams['tools'] = [
  // {
  //   type: 'function',
  //   function: {
  //     name: 'get_last_transactions',
  //     description: 'Retorna as últimas transações do usuário',
  //     parameters: {
  //       type: 'object',
  //       properties: {
  //         limit_days: {
  //           type: 'number',
  //           description: 'Número de dias para retornar as transações. Se não for informado, retorna as últimas 5 dias',
  //         },
  //         limit_transactions: {
  //           type: 'number',
  //           description: 'Número de transações para retornar. Se não for informado, retorna as últimas 5 transações',
  //         },
  //       },
  //     },
  //   },
  // },
  // {
  //   type: 'function',
  //   function: {
  //     name: 'monthly_spending_summary',
  //     description: 'Retorna um resumo do gasto do mês corrente',
  //   },
  // },
  // {
  //   type: 'function',
  //   function: {
  //     name: 'spending_summary_30_days',
  //     description: 'Retorna um resumo do gasto dos últimos 30 dias',
  //   },
  // },
  // {
  //   type: 'function',
  //   function: {
  //     name: 'cancel_subscription',
  //     description: 'Cancela a assinatura do usuário',
  //   },
  // },
  {
    type: 'function',
    function: {
      name: 'delegate_message',
      description: 'Delega a mensagem para outro agente',
      parameters: {
        type: 'object',
        properties: {
          agent: {
            type: 'string',
            description: 'O agente a ser delegado',
          },
        },
      },
    },
  },
];

export default class UnregisteredAgent {
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
        tool_choice: 'required',
      }),
    });
    const data: OpenAI.Chat.ChatCompletion = await response.json();
    const functionCalled = data.choices[0].message.tool_calls?.[0]?.function;
    // const outputMessage = data.choices[0].message.content;

    if (!functionCalled || functionCalled.name !== 'delegate_message') {
      throw new Error('No function called');
    }

    switch (JSON.parse(functionCalled.arguments).agent) {
      case 'transaction_agent':
        console.log('DELEGATING TO TRANSACTION AGENT');
        const transactionAgent = new TransactionsAgent(this.messageHistory);
        return transactionAgent.getResponse();
      default:
        throw new Error('Invalid agent');
    }
  }
}
