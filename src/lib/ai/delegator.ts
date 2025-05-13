import OpenAI from 'openai';
import TransactionsAgent from './transactions';
import FunctionHandler from './base-handler';
import BaseAgent from './base';
import GoalsAgent from './goals';

const SYSTEM_PROMPT = `
Você é o agente principal de um sistema de organização financeira pessoal. O usuário já está registrado e autenticado.

Sua função é simplesmente identificar o contexto da mensagem e delegar para o agente adequado.

AGENTES:
1. base_agent: Agente principal
  - Trata de assinaturas, resumos de gastos, cancelamento de assinaturas, etc.
2. transaction_agent: Agente de transações
  - Trata de transações financeiras, registro, atualização e cancelamento das transações
3. goals_agent: Agente de metas financeiras
  - Trata de metas/limites financeiros
`;

const TOOLS: OpenAI.Responses.ResponseCreateParams['tools'] = [
  {
    type: 'function',
    name: 'delegate_message',
    description: 'Delega a mensagem para outro agente',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        agent: {
          type: 'string',
          description: 'O agente a ser delegado',
          enum: ['transaction_agent', 'goals_agent', 'base_agent'],
        },
      },
      required: ['agent'],
      additionalProperties: false,
    },
  },
];

const client = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY,
});

export default class DelegatorAgent {
  private messageHistory: OpenAI.Responses.ResponseInputItem[];
  constructor(messageHistory: OpenAI.Responses.ResponseInputItem[]) {
    this.messageHistory = messageHistory;
  }

  async getResponse(serverHandler: FunctionHandler) {
    // // TEMP: testando apenas goals_agent
    // const goalsAgent = new GoalsAgent(this.messageHistory);
    // this.logger('Delegating to goals agent');
    // const tokens = await goalsAgent.getResponse(serverHandler);
    // return tokens;
    // // TEMP: testando apenas base_agent
    // const baseAgent = new BaseAgent(this.messageHistory);
    // this.logger('Delegating to base agent');
    // const tokens = await baseAgent.getResponse(serverHandler);
    // return tokens;
    // // TEMP: testando apenas transaction_agent
    // const transactionAgent = new TransactionsAgent(this.messageHistory);
    // const tokens = await transactionAgent.getResponse(serverHandler);
    // return tokens;

    const body: OpenAI.Responses.ResponseCreateParams = {
      model: 'gpt-4.1-nano',
      instructions: SYSTEM_PROMPT,
      input: this.messageHistory.slice(-4),
      tools: TOOLS,
      tool_choice: 'required',
    };

    const response = await client.responses.create(body);
    let tokens = response.usage?.total_tokens ?? 0;
    const output = response.output[0];

    if (output.type !== 'function_call') {
      throw new Error('No function called');
    }

    const agent = JSON.parse(output.arguments).agent;
    switch (agent) {
      case 'transaction_agent':
        this.logger('DELEGATING TO TRANSACTION AGENT');
        const transactionAgent = new TransactionsAgent(this.messageHistory);
        tokens += await transactionAgent.getResponse(serverHandler);
        return tokens;
      case 'base_agent':
        this.logger('DELEGATING TO BASE AGENT');
        const baseAgent = new BaseAgent(this.messageHistory);
        tokens += await baseAgent.getResponse(serverHandler);
        return tokens;
      case 'goals_agent':
        this.logger('DELEGATING TO GOALS AGENT');
        const goalsAgent = new GoalsAgent(this.messageHistory);
        tokens += await goalsAgent.getResponse(serverHandler);
        return tokens;
      default:
        serverHandler.sendMessage(`Agent not implemented yet: ${agent}`);
        this.logger(`Agent not implemented: ${agent}`, 'error');
        return tokens;
      // throw new Error(`Invalid agent: ${agent}`);
    }
  }

  logger(message: string, level: 'log' | 'info' | 'error' = 'log') {
    console[level]('\x1b[34m DELEGATOR AGENT: \x1b[0m ', message);
  }
}
