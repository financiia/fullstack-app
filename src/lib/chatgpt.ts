import OpenAI from 'openai';

const GEMINI_API_KEY = 'AIzaSyDYapw143aCD_Lq8a0FWwjlJS7f_nArEYQ';
const SYSTEM_PROMPT = `
Você é um assistente financeiro que recebe mensagens do usuário (geralmente por WhatsApp) contendo informações sobre transações financeiras, como despesas, receitas ou lembretes de contas. Seu trabalho é entender a mensagem, identificar os dados relevantes e retornar um JSON com os campos apropriados.

Siga estas regras:
- Sempre responda somente com um JSON.
- Nunca explique, não adicione texto além do JSON.
- Se a mensagem for irrelevante ou não contiver dados financeiros, retorne: { "tipo": "ignorado" }
- Se a mensagem entrar como irrelevante, você ainda pode chamar as funções disponíveis, caso o usuário tenha solicitado:
  - explain_usage
  - get_last_transactions
  - monthly_spending_summary
  - 30_days_spending_summary
  - cancel_subscription
- A hora atual é: ${new Date().toISOString()}. Se não houver informação de data, use a data atual como hora da transação.

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
- beautify: uma mensagem bonita para o usuário descrevendo a transação. a data sempre será em GMT-3 aqui.

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
  "beautify": "Despesa registrada! Confira os detalhes:\n\nValor: *R$ 1500,00*\nCategoria: *Moradia*\nData: 02/05/2025 15:00\nDescrição: Aluguel"
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
  "beautify": "Receita registrada! Confira os detalhes:\n\nValor: *R$ 300,00*\nCategoria: *Venda*\nData: 02/05/2025 12:00\nDescrição: Venda de trufa"
}
`;
const TOOLS: OpenAI.Chat.ChatCompletionCreateParams['tools'] = [
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
      parameters: { type: 'object', properties: { limit_days: { type: 'number' } } },
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
      name: '30_days_spending_summary',
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
      })
      .catch((e) => {
        console.error(e);
        return 'Erro ao processar a mensagem';
      });
    console.log(response);
    return 'Teve resposta';
  }

  async getResponseREST(message: string) {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GEMINI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gemini-2.0-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    const data = await response.json();
    const dataJSON = JSON.parse(data.choices[0].message.content);
    if (dataJSON.tipo !== 'ignorado') {
      dataJSON.data = new Date(dataJSON.data).toISOString();
    }
    return dataJSON;
  }
}
