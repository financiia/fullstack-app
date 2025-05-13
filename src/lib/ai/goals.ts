import OpenAI from 'openai';
import FunctionHandler from './base-handler';
import { cloneDeep } from 'lodash';
// import { groupBy } from 'lodash';
// import { Database } from '../database.types';
// import { capitalize } from 'lodash';

// 🧠 Prompt do agente para usuário não registrado:
const SYSTEM_PROMPT = `
Você é uma assistente de IA de organização financeira chamada Marill.IA especializada em ajudar com limites de gastos mensais (metas financeiras). Você ajuda o usuário a definir, atualizar e acompanhar seus tetos de gastos de forma amigável e objetiva.

Seu papel é:
- Ajudar o usuário a definir limites mensais realistas para suas despesas
- Configurar tetos de gastos por categoria (ex: alimentação, transporte) ou global
- Atualizar limites existentes quando solicitado
- Remover limites que não são mais relevantes
- Mostrar os limites atuais e como estão sendo cumpridos

Você pode responder perguntas como:
- "Quais são meus limites de gastos atuais?"
- "Quero definir um limite de 800 reais pra alimentação"
- "Preciso aumentar meu teto de gastos com transporte"
- "Pode remover o limite da categoria lazer?"
- "Quero estabelecer um limite total de 3 mil por mês"

Quando o usuário quiser criar ou atualizar um limite, certifique-se de coletar:
- Se é um limite global ou por categoria específica
- Valor máximo mensal permitido
- Observações ou regras especiais (opcional)

### Exemplos de conversa

Usuário: quais são meus limites de gastos?
Você: Vou buscar todos os seus tetos de gastos configurados.
-> chama a função get_all_goals

---
Usuário: quero definir um limite de 500 reais pra alimentação
Você: Ótimo! Vou configurar esse teto de gastos para a categoria alimentação.
-> chama a função upsert_goal com os dados fornecidos

---
Usuário: preciso aumentar meu limite mensal total pra 3500
Você: Certo! Vou atualizar seu teto de gastos global para R$ 3.500 por mês.
-> chama a função upsert_goal com os dados atualizados

---
Usuário: quero remover o limite da categoria lazer
Você: Tem certeza que quer remover o limite de gastos da categoria lazer? Essa ação não pode ser desfeita.
Usuário: sim, pode remover
Você: Ok, vou remover esse limite agora.
-> chama a função delete_goal

Mantenha um tom amigável e encorajador, mas também realista. Se o usuário definir limites muito baixos ou irrealistas para seu padrão de gastos, sugira gentilmente ajustes mais realistas baseados no histórico.

Evite sair do escopo de limites de gastos. Se o usuário perguntar sobre outros temas financeiros, explique que você é especializada em gerenciar tetos de gastos e sugira que ele converse com o assistente principal para outros assuntos.
`;

const TOOLS: OpenAI.Responses.ResponseCreateParams['tools'] = [
  {
    type: 'function',
    name: 'get_all_goals',
    description: 'Retorna todas as metas do usuário',
    parameters: { type: 'object', properties: {}, additionalProperties: false, required: [] },
    strict: true,
  },
  {
    type: 'function',
    name: 'upsert_goal',
    description: 'Atualiza ou cria uma meta do usuário',
    parameters: {
      type: 'object',
      properties: {
        categoria: {
          type: 'string',
          description: 'Categoria da meta',
          enum: ['global', 'alimentação', 'transporte', 'moradia', 'saúde', 'lazer', 'outros'],
        },
        meta: { type: 'number', description: 'Valor limite estipulado pelo usuário' },
      },
      additionalProperties: false,
      required: ['categoria', 'meta'],
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'delete_goal',
    description: 'Deleta uma meta do usuário',
    parameters: {
      type: 'object',
      properties: {
        categoria: {
          type: 'string',
          description: 'Categoria da meta',
          enum: ['global', 'alimentação', 'transporte', 'moradia', 'saúde', 'lazer', 'outros'],
        },
      },
      additionalProperties: false,
      required: ['categoria'],
    },
    strict: true,
  },
];

const client = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY,
});

export default class GoalsAgent {
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
  }

  async getResponse(serverHandler: FunctionHandler) {
    // Antes da chamada, vamos já jogar no prompt as informações de como estão as metas atualmente
    const goalsHandler = new GoalsHandler(serverHandler);
    const userGoals = await goalsHandler.getAllGoals();

    // Garante que não tenha 2 mensagens mostrando as metas atuais
    this.messageHistory = this.messageHistory.filter((message) => {
      if (!('role' in message)) return true;
      if (!('content' in message)) return true;
      if (message.role !== 'developer') return true;
      if (typeof message.content === 'string' && message.content.includes('Andamento atual das metas')) return false;
      return true;
    });

    this.messageHistory.push({
      role: 'developer',
      content: `Andamento atual das metas: ${userGoals}`,
    });

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
        const functionOutput = await goalsHandler.handleFunctionCall(output);
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
    console[level]('\x1b[31m GOALS AGENT: \x1b[0m ', message);
  }
}

export class GoalsHandler {
  constructor(private serverHandler: FunctionHandler) {}

  async handleFunctionCall(functionCalled: { name: string; arguments: string }) {
    const parsedArguments = JSON.parse(functionCalled.arguments);

    this.logger(`Handling function ${functionCalled.name}`);
    this.logger(`Arguments: ${JSON.stringify(parsedArguments)}`);

    switch (functionCalled.name) {
      case 'get_all_goals':
        return this.getAllGoals();
      case 'upsert_goal':
        return this.upsertGoal(parsedArguments);
      case 'delete_goal':
        return this.deleteGoal(parsedArguments);
      default:
        throw new Error('Invalid function name');
    }
  }

  async getAllGoals() {
    this.logger(`Getting all goals`);

    const currentMonth = new Date().toISOString().split('-').slice(0, 2).join('-') + '-01';
    const { data: userGoals } = await this.serverHandler.supabase
      .from('user_goals_progress')
      .select('categoria, meta, total_gasto')
      .eq('user_id', this.serverHandler.user!.id)
      .or(`mes_referencia.is.null, mes_referencia.eq.${currentMonth}`);

    // Se existir limite da categoria 'global', devemos adicionar o total gasto
    const globalGoal = userGoals?.find((goal) => goal.categoria === 'global');
    if (globalGoal) {
      const { data: totalGasto } = await this.serverHandler.supabase
        .from('transactions')
        .select('valor.sum()')
        .eq('user_id', this.serverHandler.user!.id)
        .gte('data', currentMonth)
        .single();

      globalGoal.total_gasto = totalGasto?.sum ?? 0;
    }

    return JSON.stringify(
      userGoals?.map((goal) => ({
        ...goal,
        total_gasto: goal.total_gasto ?? 0,
        percentual_gasto: (100 * ((goal.total_gasto ?? 0) / (goal.meta ?? 1))).toFixed(0),
      })),
    );
  }

  async upsertGoal(parsedArguments: { categoria: string; meta: number }) {
    this.logger(`Upserting goal`);

    // Checa se o usuário já tem uma meta para essa categoria
    const { data: userGoal } = await this.serverHandler.supabase
      .from('goals')
      .select('id, valor')
      .eq('user_id', this.serverHandler.user!.id)
      .eq('categoria', parsedArguments.categoria)
      .single();

    if (userGoal) {
      this.logger(`User already has a goal for this category`);
      const { error } = await this.serverHandler.supabase
        .from('goals')
        .update({ valor: parsedArguments.meta })
        .eq('id', userGoal.id)
        .select()
        .single();

      if (error) {
        this.logger(`Error updating goal: ${error.message}`);
        return 'Erro ao atualizar meta';
      }

      return `A meta que antes era de ${userGoal.valor} reais foi alterada para ${parsedArguments.meta} reais`;
    }

    const { data: goal } = await this.serverHandler.supabase
      .from('goals')
      .insert({
        categoria: parsedArguments.categoria,
        valor: parsedArguments.meta,
        user_id: this.serverHandler.user!.id,
      })
      .select()
      .single();

    if (goal) {
      return 'Meta inserida com sucesso';
    }

    return 'Erro ao inserir meta';
  }

  async deleteGoal(parsedArguments: { categoria: string }) {
    this.logger(`Deleting goal`);
    this.logger(`Arguments: ${JSON.stringify(parsedArguments)}`);

    const { error } = await this.serverHandler.supabase
      .from('goals')
      .delete()
      .eq('user_id', this.serverHandler.user!.id)
      .eq('categoria', parsedArguments.categoria)
      .select()
      .single();

    if (error) {
      this.logger(`Error deleting goal: ${error.message}`);
      return 'Erro ao deletar meta';
    }

    return 'Meta deletada com sucesso';
  }

  logger(message: string, level: 'log' | 'info' | 'error' = 'log') {
    console[level]('\x1b[34m GOALS AGENT HANDLER: \x1b[0m ', message);
  }
}
