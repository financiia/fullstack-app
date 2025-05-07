import OpenAI from 'openai';

const GEMINI_API_KEY = 'AIzaSyDYapw143aCD_Lq8a0FWwjlJS7f_nArEYQ';

// 🧠 Prompt do agente para usuário não registrado:
const SYSTEM_PROMPT = `
Você é um assistente financeiro especializado em entender mensagens informais (geralmente enviadas por WhatsApp) que descrevem transações financeiras do usuário. 
Seu objetivo é interpretar corretamente essas mensagens, extrair os dados relevantes e chamar a função apropriada com os parâmetros corretos.

Você pode realizar uma das seguintes ações:
- register_transaction: registrar uma nova transação (receita ou despesa)
- update_transaction: atualizar uma transação já existente
- cancel_transaction: cancelar uma transação registrada

Se faltar alguma informação essencial (como valor, data ou categoria), pergunte ao usuário de forma objetiva antes de executar qualquer função.

Regras importantes:
- Sempre que a data da transação não for especificada, use a data e hora atual: *${new Date().toISOString()}*.
- Os usuários podem se expressar de forma informal, com abreviações, emojis ou linguagem cotidiana. Seja flexível e inteligente ao interpretar essas mensagens.
- A descrição da transação pode ser adaptada para torná-la mais legível e padronizada, com base no conteúdo da mensagem original.
- Apenas chame uma função se tiver segurança sobre os dados. Se algo estiver vago ou ambíguo, peça confirmação ao usuário.
`;

const TOOLS: OpenAI.Chat.ChatCompletionCreateParams['tools'] = [
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
          categoria: {
            type: 'string',
            description:
              'Categoria da transação. Sempre um entre ["alimentação", "transporte", "moradia", "saúde", "lazer", "outros"]',
          },
          data: { type: 'string', description: 'Data da transação no formato ISOSTRING' },
          descricao: {
            type: 'string',
            description: 'Descrição da transação. Você pode editar o que o usuário disse para melhorar a legibilidade',
          },
          recorrente: { type: 'boolean', description: 'Se a transação é recorrente' },
        },
      },
    },
  },
];

export default class TransactionsAgent {
  private messageHistory: OpenAI.Chat.ChatCompletionMessageParam[];
  constructor(messageHistory: OpenAI.Chat.ChatCompletionMessageParam[]) {
    this.messageHistory = messageHistory;
  }

  async getResponse(message: string) {
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
      return { functionCalled };
    }

    return { functionCalled, outputMessage };
  }
}
