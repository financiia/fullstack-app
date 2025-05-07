import OpenAI from 'openai';

const GEMINI_API_KEY = 'AIzaSyDYapw143aCD_Lq8a0FWwjlJS7f_nArEYQ';
const SYSTEM_PROMPT = `
Você é um assistente financeiro que recebe mensagens do usuário (geralmente por WhatsApp) contendo informações sobre transações financeiras, como despesas, receitas ou lembretes de contas. Seu trabalho é entender a mensagem, identificar os dados relevantes e retornar um JSON com os campos apropriados.

Siga estas regras:
- A função principal a ser chamada é a register_transaction. Caso a mensagem não seja uma transação, chame uma das funções disponíveis:
  - explain_usage
  - get_last_transactions
  - monthly_spending_summary
  - 30_days_spending_summary
  - cancel_subscription
  - no_action

Campos do JSON:
- tipo: "despesa", "receita", "lembrete" ou "ignorado"
- valor: número decimal (ex: 55.90)
- categoria: uma palavra que representa o tipo de gasto. As categorias possíveis são:
    - "alimentação"
    - "transporte" // combustível, ônibus, etc
    - "moradia" // aluguel, condomínio, internet, água, luz, etc
    - "saúde" // remédios, exames, psicólogo, fisioterapia, etc
    - "lazer" // cinema, parque, praia, etc
    - "outros" // todo o resto
- data: se houver uma data mencionada, SEMPRE NO FORMATO ISOSTRING; caso contrário, use a data de hoje
- descricao: texto resumido da transação
- recorrente: true se for algo que se repete mensalmente (ex: aluguel), false caso contrário

Exemplos:
Usuário: "paguei o aluguel hoje, 1500 reais"
Resposta:
{
  "tipo": "despesa",
  "valor": 1500.00,
  "categoria": "moradia",
  "data": "2025-05-02T18:00:00.000Z",
  "descricao": "aluguel",
  "recorrente": true,
}

Usuário: "ganhei 300 reais vendendo trufa"
Resposta:
{
  "tipo": "receita",
  "valor": 300.00,
  "categoria": "venda",
  "data": "2025-05-02T15:00:00.000Z",
  "descricao": "venda de trufa",
  "recorrente": false,
}

*A hora atual é: ${new Date().toISOString()}. Se não houver informação de data, use a data atual como hora da transação*
`;
const TOOLS: OpenAI.Chat.ChatCompletionCreateParams['tools'] = [
  {
    type: 'function',
    function: {
      name: 'no_action',
      description: 'Não faz nada',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description:
              'Resposta educada para o usuário indicando que não foi possível identificar uma ação a ser tomada',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'explain_usage',
      description: 'Explica o uso do sistema',
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_last_transactions',
      description: 'Retorna as últimas transações do usuário',
      parameters: {
        type: 'object',
        properties: {
          limit_days: {
            type: 'number',
            description: 'Número de dias para retornar as transações. Se não for informado, retorna as últimas 5 dias',
          },
          limit_transactions: {
            type: 'number',
            description: 'Número de transações para retornar. Se não for informado, retorna as últimas 5 transações',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'monthly_spending_summary',
      description: 'Retorna um resumo do gasto do mês corrente',
    },
  },
  {
    type: 'function',
    function: {
      name: 'spending_summary_30_days',
      description: 'Retorna um resumo do gasto dos últimos 30 dias',
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_subscription',
      description: 'Cancela a assinatura do usuário',
    },
  },
  {
    type: 'function',
    function: {
      name: 'register_transaction',
      description: 'Registra uma transação do usuário',
      parameters: {
        type: 'object',
        properties: {
          tipo: { type: 'string', description: 'Tipo da transação: "despesa" ou "receita"' },
          valor: { type: 'number', description: 'Valor da transação' },
          categoria: { type: 'string', description: 'Categoria da transação' },
          data: { type: 'string', description: 'Data da transação no formato ISOSTRING' },
          descricao: { type: 'string', description: 'Descrição da transação' },
          recorrente: { type: 'boolean', description: 'Se a transação é recorrente' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'define_monthly_goal',
      description: 'Define a meta mensal do usuário para uma categoria OU global',
      parameters: {
        type: 'object',
        properties: {
          tipo: { type: 'string', description: 'Categoria da meta OU "global"' },
          valor: { type: 'number', description: 'Valor da meta' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_transaction',
      description: 'Atualiza uma transação existente',
      parameters: {
        type: 'object',
        properties: {
          tipo: { type: 'string', description: 'Tipo da transação: "despesa" ou "receita"' },
          valor: { type: 'number', description: 'Valor da transação' },
          categoria: { type: 'string', description: 'Categoria da transação' },
          data: { type: 'string', description: 'Data da transação no formato ISOSTRING' },
          descricao: { type: 'string', description: 'Descrição da transação' },
          recorrente: { type: 'boolean', description: 'Se a transação é recorrente' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_subscription_confirmation',
      description: 'Confirma a decisão de cancelar a assinatura do usuário',
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_transaction',
      description: 'Cancela uma transação existente',
    },
  },

  // {
  //   type: 'function',
  //   function: {
  //     name: 'register_user',
  //     description: 'Registra o usuário no sistema e manda um link de pagamento com 30 dias de teste'
  //   },
  // }, // TODO: criar outro prompt para usuário não registrado
];

const openai = new OpenAI({
  apiKey: GEMINI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  dangerouslyAllowBrowser: true,
});

export default class ChatGPT {
  constructor() {}

  async getResponse(message: string) {
    const response = await openai.chat.completions
      .create({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: message,
          },
        ],
        tools: TOOLS,
      })
      .catch((e) => {
        console.error(e);
        return 'Erro ao processar a mensagem';
      });
    console.log(response);
    return 'Teve resposta';
  }

  async getResponseREST(message: string, assistantMessage?: string) {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: message },
    ];
    if (assistantMessage) {
      messages.splice(1, 0, { role: 'assistant', content: assistantMessage });
    }

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
    const data = await response.json();
    if (!data.choices) {
      console.error(data[0].error);
      throw new Error(data[0].error.message);
    }
    const functionCalled = data.choices[0].message.tool_calls[0].function;
    return functionCalled;
  }
}
