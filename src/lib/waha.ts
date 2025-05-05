const WAHA_BASE_URL = 'https://waha.acan.credit/api';
const WAHA_API_KEY = '5BP#r*WSR77blS';

export default class Waha {
  constructor() {}

  async sendMessageWithTyping(previousMessage: string | null, phone: string, message: string) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    if (!!previousMessage) {
      await fetch(`${WAHA_BASE_URL}/sendSeen`, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': `${WAHA_API_KEY}`,
        },
        method: 'POST',
        body: JSON.stringify({ chatId: phone, messageId: previousMessage, session: 'Financiia' }),
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await fetch(`${WAHA_BASE_URL}/startTyping`, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': `${WAHA_API_KEY}`,
      },
      method: 'POST',
      body: JSON.stringify({ chatId: phone, session: 'Financiia' }),
    });
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const response = await fetch(`${WAHA_BASE_URL}/sendText`, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': `${WAHA_API_KEY}`,
      },
      method: 'POST',
      body: JSON.stringify({ chatId: phone, text: message, session: 'Financiia', reply_to: previousMessage }),
    });

    await fetch(`${WAHA_BASE_URL}/stopTyping`, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': `${WAHA_API_KEY}`,
      },
      method: 'POST',
      body: JSON.stringify({ chatId: phone, session: 'Financiia' }),
    });

    return response.json().then((res) => res.key.id);
  }

  async sendReactionJoinha(previousMessage: string, phone: string) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await fetch(`${WAHA_BASE_URL}/sendSeen`, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': `${WAHA_API_KEY}`,
      },
      method: 'POST',
      body: JSON.stringify({ chatId: phone, messageId: previousMessage, session: 'Financiia' }),
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));
    await fetch(`${WAHA_BASE_URL}/reaction`, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': `${WAHA_API_KEY}`,
      },
      method: 'PUT',
      body: JSON.stringify({ reaction: '👍', session: 'Financiia', messageId: previousMessage }),
    }).then(console.log);
  }
}
