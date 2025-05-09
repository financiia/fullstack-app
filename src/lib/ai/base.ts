import OpenAI from 'openai';
import FunctionHandler from './base-handler';
import { cloneDeep } from 'lodash';
// import { groupBy } from 'lodash';
// import { Database } from '../database.types';
// import { capitalize } from 'lodash';

// 🧠 Prompt do agente para usuário não registrado:
const SYSTEM_PROMPT = `
Você é uma assistente de IA de organização financeira chama Marill.IA  atencioso, que conversa com o usuário e responde dúvidas simples sobre sua organização financeira. 
Seu papel é oferecer um atendimento amigável e objetivo, sempre dentro do tema de finanças pessoais.

Você pode responder perguntas como:
- "Quais foram meus últimos gastos?"
- "Quanto eu gastei em abril?"
- "Quero cancelar minha assinatura"
- "Quais são os benefícios do plano?"

Você pode chamar qualquer uma das funções abaixo se fizer sentido com o que o usuário disse. Quando fizer isso, apenas chame a função — não envie mensagens adicionais para o usuário junto com a chamada da função. 
Se for necessário responder ao usuário antes da função, você pode enviar uma mensagem, e depois disso chamar a função.

Sempre que possível, use uma linguagem natural, simples e humana. 

Evite sair do escopo de finanças pessoais. Se o usuário perguntar algo fora do tema, gentilmente traga o foco de volta para finanças.

- Não precisa ficar dizendo que os valores são aproximados. Pode só colocar os valores.

### Exemplos de conversa

Usuário: quero ver meus últimos gastos  
Você: Claro! Aqui estão suas últimas transações:  
-> chama a função get_latest_transactions

Usuário: quero saber quanto gastei nos últimos 30 dias  
Você: Perfeito, vou fazer esse resumo pra você agora  
-> chama a função get_30_day_summary

Usuário: e no mês de março?  
Você: Um instante, já pego o resumo de março pra você  
-> chama a função get_monthly_summary com o mês correspondente

Usuário: quero cancelar minha assinatura  
Você: Entendido, vou cancelar sua assinatura agora  
-> chama a função cancel_subscription

Usuário: qual é o meu plano hoje?  
Você: Você está no plano básico. Ele custa R$ 5,90 por mês e oferece acesso completo ao assistente financeiro, metas, relatórios e lembretes.  
-> chama a função get_subscription_details (se necessário)
`;

const TOOLS: OpenAI.Responses.ResponseCreateParams['tools'] = [
  {
    type: 'function',
    name: 'get_latest_transactions',
    description: 'Pega as últimas transações do usuário',
    strict: false,
    parameters: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description: 'Quantidade de transações a serem pegas. Se não informado diretamente, não passe nada.',
        },
        time_limit_days: {
          type: 'number',
          description: 'Limite de tempo para pegar as transações. Se não informado diretamente, não passe nada.',
        },
        categoria: {
          type: 'string',
          description: 'Categoria das transações a serem pegas. Se não informado diretamente, não passe nada.',
          enum: ['alimentação', 'transporte', 'moradia', 'saúde', 'lazer', 'outros'],
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  // {
  //   type: 'function',
  //   name: 'cancel_subscription',
  //   description: 'Cancela a assinatura atual do usuário',
  //   parameters: { type: 'object', properties: {}, additionalProperties: false, required: [] },
  //   strict: true,
  // },
  // {
  //   type: 'function',
  //   name: 'get_subscription_details',
  //   description: 'Busca os detalhes da assinatura atual do usuário',
  //   parameters: { type: 'object', properties: {}, additionalProperties: false, required: [] },
  //   strict: true,
  // },
  {
    type: 'function',
    name: 'get_monthly_summary',
    description: 'Retorna quanto foi gasto em cada categoria no mês informado',
    parameters: {
      type: 'object',
      properties: {
        month: {
          type: 'string',
          description: 'Mês no formato ISO (exemplo: "2025-04-01")',
        },
      },
      required: ['month'],
      additionalProperties: false,
    },
    strict: true,
  },
  // {
  //   type: 'function',
  //   name: 'get_30_day_summary',
  //   description: 'Retorna um resumo das transações dos últimos 30 dias',
  //   parameters: {
  //     type: 'object',
  //     properties: {},
  //     additionalProperties: false,
  //     required: [],
  //   },
  //   strict: true,
  // },
];

const client = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY,
});

export default class BaseAgent {
  private messageHistory: OpenAI.Responses.ResponseInput;
  should_reset = false;

  constructor(messageHistory: OpenAI.Responses.ResponseInput) {
    this.messageHistory = messageHistory;

    // Joga a informação de data atual na última mensagem pra não matar a função de caching do gpt
    this.messageHistory.push({
      role: 'developer',
      content: `A data atual é *${new Date().toISOString()}* e hoje é um dia de **${new Date().toLocaleDateString('pt-BR', { weekday: 'long' })}**.`,
    });

    const { history, should_reset } = this.getHistory();
    this.messageHistory = history;
    this.should_reset = should_reset;
    // this.messageHistory[0].content += `\n A data atual é *${new Date().toISOString()}* e hoje é um dia de **${new Date().toLocaleDateString('pt-BR', { weekday: 'long' })}**.`;
  }

  async getResponse(serverHandler: FunctionHandler) {
    // // Tmp
    // const baseHandler = new BaseHandler(serverHandler);
    // await baseHandler.getMonthlySummary({ month: '2025-05-01' }).then((res) => console.log(res));
    // return 0;
    // const { history, should_reset } = this.getHistory();
    const body: OpenAI.Responses.ResponseCreateParams = {
      model: 'gpt-4.1-nano',
      instructions: SYSTEM_PROMPT,
      input: this.messageHistory,
      tools: TOOLS,
      tool_choice: 'auto',
      previous_response_id: this.should_reset ? undefined : serverHandler.user!.previous_response_id,
    };

    const response = await client.responses.create(body);
    const user = await serverHandler.supabase
      .from('users')
      .update({ previous_response_id: response.id })
      .eq('id', serverHandler.user!.id)
      .select()
      .single()
      .then((res) => res.data);
    if (user) {
      serverHandler.user = user;
    }
    this.should_reset = false;

    let tokens = response.usage?.total_tokens ?? 0;
    this.logger(`Spent ${tokens} tokens`);

    // We should make sure chatgpt is not calling any function twice
    const uniqueOutputs = [...new Set(response.output.map((output) => JSON.stringify(output)))];
    const uniqueOutputsObject: typeof response.output = uniqueOutputs.map((output) => JSON.parse(output));

    const functionOutputs: OpenAI.Responses.ResponseInput = [];

    for (const output of uniqueOutputsObject) {
      if (output.type === 'function_call') {
        const baseHandler = new BaseHandler(serverHandler);
        const functionOutput = await baseHandler.handleFunctionCall(output);
        functionOutputs.push({
          type: 'function_call_output',
          call_id: output.call_id,
          output: functionOutput ?? 'Erro ao executar função',
        });
      }
      if (output.type === 'message' && output.content[0].type === 'output_text') {
        await serverHandler.sendMessage(output.content[0].text);
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Se as chamadas forem pre fixadas de mensagem, espera 5 segundos pra fingir que está processando.
      }
    }

    this.messageHistory = functionOutputs;
    if (functionOutputs.length > 0) {
      tokens += await this.getResponse(serverHandler);
    }

    return tokens;
  }

  getHistory() {
    if (
      !this.messageHistory.some((message) => (message as OpenAI.Responses.ResponseOutputMessage).role === 'assistant')
    )
      return { history: this.messageHistory, should_reset: true };

    let history = cloneDeep(this.messageHistory);
    history.reverse();
    const assistantMessage = history.find(
      (message) => (message as OpenAI.Responses.ResponseOutputMessage).role === 'assistant',
    );

    // @ts-expect-error Já foi verificado que existe uma mensagem de assistente
    const assistantMessageIndex = history.indexOf(assistantMessage);
    history = history.slice(1, assistantMessageIndex);
    history.reverse();
    return { history, should_reset: false };
  }

  logger(message: string, level: 'log' | 'info' | 'error' = 'log') {
    console[level]('\x1b[31m BASE AGENT: \x1b[0m ', message);
  }
}

export class BaseHandler {
  constructor(private serverHandler: FunctionHandler) {}

  handleFunctionCall(functionCalled: { name: string; arguments: string }) {
    const parsedArguments = JSON.parse(functionCalled.arguments);

    this.logger(`Handling function ${functionCalled.name}`);
    switch (functionCalled.name) {
      case 'get_latest_transactions':
        return this.getLatestTransactions(parsedArguments);
      case 'get_monthly_summary':
        return this.getMonthlySummary(parsedArguments);
      default:
        throw new Error('Invalid function name');
    }
  }

  async getLatestTransactions(parsedArguments: { count?: number; time_limit_days?: number; categoria?: string }) {
    let { count, time_limit_days } = parsedArguments;
    this.logger(
      `Getting latest transactions with count: ${count} and time_limit_days: ${time_limit_days} and categoria: ${parsedArguments.categoria}`,
    );

    let query;
    const baseQuery = this.serverHandler.supabase
      .from('transactions')
      .select('*')
      .eq('user_id', this.serverHandler.user!.id)
      .order('data', { ascending: false });

    if (!count && !time_limit_days) {
      count = 10;
      time_limit_days = 5;

      query = baseQuery.limit(count).gte('data', new Date(Date.now() - time_limit_days * 24 * 60 * 60 * 1000));
    }

    if (count) {
      query = baseQuery.limit(count);
    }

    if (time_limit_days) {
      query = baseQuery.gte('data', new Date(Date.now() - time_limit_days * 24 * 60 * 60 * 1000).toISOString());
    }

    if (parsedArguments.categoria) {
      query = query?.eq('categoria', parsedArguments.categoria);
    }

    const transactions = await query?.then((res) => res.data);

    if (!transactions) {
      await this.serverHandler.sendMessage(
        'Não foi possível carregar as transações. Tente novamente mais tarde ou entre em contato com o suporte.',
      );
      return;
    }

    return JSON.stringify(transactions);

    //     const groupedByDay = Object.entries(
    //       groupBy(transactions, (transaction) => new Date(transaction.data).toLocaleDateString('en-US')),
    //     );
    //     groupedByDay.sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());

    //     function formatTransaction(transaction: Database['public']['Tables']['transactions']['Row']) {
    //       return `- ${new Date(transaction.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}: R$ ${transaction.valor.toFixed(2)} - ${transaction.descricao} (#${transaction.id})`;
    //     }

    //     function isSameWeek(date: Date): boolean {
    //       const today = new Date();
    //       if (Math.abs(date.getTime() - today.getTime()) > 7 * 24 * 60 * 60 * 1000) {
    //         return false;
    //       }
    //       if (date.getDay() <= today.getDay()) {
    //         return true;
    //       }
    //       return false;
    //     }

    //     function formatDay(day: string) {
    //       // Se for na mesma semana, coloca só o weekday long
    //       // Se for na semana passada mas com menos de 7 dias, coloca 'Último [weekday]'
    //       // Se for no mesmo mês, coloca 'Dia [day]'
    //       // Em outros casos, coloca '[day] de [month]'
    //       const date = new Date(day);
    //       const today = new Date();
    //       const sameWeek = isSameWeek(date);
    //       const isSameMonth = date.getMonth() === today.getMonth();
    //       if (sameWeek) {
    //         if (date.getDay() === today.getDay()) {
    //           return 'Hoje';
    //         }
    //         if (date.getDay() === today.getDay() - 1) {
    //           return 'Ontem';
    //         }
    //         return `${new Date(day).toLocaleDateString('pt-BR', { weekday: 'long' })}:`;
    //       }
    //       if (date.getDate() < today.getDate() - 7) {
    //         return `Último ${new Date(day).toLocaleDateString('pt-BR', { weekday: 'long' })}:`;
    //       }
    //       if (isSameMonth) {
    //         return `Dia ${new Date(day).toLocaleDateString('pt-BR', { day: 'numeric' })}:`;
    //       }
    //       return `${new Date(day).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}:`;
    //     }

    //     const getIntro = () => {
    //       if (transactions.length <= (count ?? 0)) {
    //         return `Aqui estão suas últimas *${transactions.length}* transações`;
    //       }
    //       return `Aqui estão suas transações dos últimos *${time_limit_days}* dias`;
    //     };
    //     const message = `
    // ${getIntro()} ${parsedArguments.categoria ? `na categoria *${parsedArguments.categoria}*` : ''}:

    // ${groupedByDay
    //   .map(
    //     ([day, transactions]) =>
    //       `*${capitalize(formatDay(day))}*
    // ${transactions
    //   .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    //   .map(formatTransaction)
    //   .join('\n')}`,
    //   )
    //   .join('\n\n')}
    // `;

    //     return message;
    //     // await this.serverHandler.sendMessage(message);
  }

  async getMonthlySummary(parsedArguments: { month: string }) {
    const { month } = parsedArguments;
    this.logger(`Getting monthly summary for ${month}`);
    const date = new Date(month);
    const monthStart = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 2, 1);
    const { data: transactions, error } = await this.serverHandler.supabase
      .from('transactions')
      .select('categoria, total_gasto:valor.sum(), quantidade_transacoes:valor.count()')
      .eq('user_id', this.serverHandler.user!.id)
      .gte('data', monthStart.toISOString())
      .lte('data', monthEnd.toISOString());

    if (!transactions) {
      return error.message;
    }

    return JSON.stringify(transactions.map((t) => ({ ...t, meta: 500 })));
    // return transactions?.map((t) => `${t.categoria} - R$${t.valor.toFixed(2)}`).join('\n');
  }

  logger(message: string, level: 'log' | 'info' | 'error' = 'log') {
    console[level]('\x1b[34m TRANSACTIONS HANDLER: \x1b[0m ', message);
  }
}
