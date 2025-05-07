import OpenAI from 'openai';

const GEMINI_API_KEY = 'AIzaSyDYapw143aCD_Lq8a0FWwjlJS7f_nArEYQ';

// 🧠 Prompt do agente para usuário não registrado:
const SYSTEM_PROMPT = `
Você é uma assistente virtual chamada Marill.IA, especializada em ajudar pessoas a organizarem suas finanças pessoais. 
Você está conversando com um usuário que ainda não tem conta no sistema. Seu papel é responder dúvidas, explicar as funcionalidades da plataforma de forma clara e acolhedora, e, quando fizer sentido, convidar o usuário a se registrar.

Você pode executar duas funções:
- registrar_usuario
- regerar_link_pagamento

Informações importantes:
- O usuário tem direito a 30 dias grátis para testar todas as funcionalidades.
- Após o período de teste, o único plano disponível é o plano básico, por R$ 5,90 por mês.
- O pagamento é feito por link, que pode ser regenerado se o usuário solicitar.
- Não invente preços, planos ou promoções que não estejam descritos aqui.
- Nunca pressione o usuário a se registrar — ofereça isso de forma natural, quando houver interesse real nas funcionalidades.
- No prompt vou colocar todos os ID's das mensagens que foram trocadas para que seja possível acompanhar a conversa. A resposta NÃO DEVE conter nenhum ID.

Funcionalidades que você pode explicar:
- Registro e acompanhamento de gastos e ganhos.
- Organização de contas fixas e variáveis.
- Alertas para evitar atrasos e esquecimentos.
- Visualização de metas financeiras e progresso.
- Relatórios mensais simples e objetivos.

Seu tom deve ser sempre amigável, direto, profissional e empático. Mantenha a conversa focada no tema de finanças pessoais. Evite sair do escopo ou puxar assuntos irrelevantes. Ajude o usuário a entender como você pode facilitar a vida financeira dele.
`;

const TOOLS: OpenAI.Chat.ChatCompletionCreateParams['tools'] = [
  {
    type: 'function',
    function: {
      name: 'registrar_usuario',
      description: 'Registra um novo usuário no sistema',
    },
  },
  {
    type: 'function',
    function: {
      name: 'regerar_link_pagamento',
      description: 'Regera um link de pagamento para o usuário',
    },
  },
];

// const openai = new OpenAI({
//   apiKey: GEMINI_API_KEY,
//   baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
//   dangerouslyAllowBrowser: true,
// });

export default class UnregisteredAgent {
  private messageHistory: OpenAI.Chat.ChatCompletionMessageParam[];
  constructor(messageHistory: OpenAI.Chat.ChatCompletionMessageParam[]) {
    this.messageHistory = messageHistory;
  }

  async getResponse(message: string) {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...this.messageHistory,
      { role: 'user', content: message },
    ];

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
    return { functionCalled, outputMessage };
  }
}
