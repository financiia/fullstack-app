// const WAHA_BASE_URL = 'https://waha.acan.credit/api';
const WAHA_BASE_URL = process.env.WAHA_BASE_URL;
const WAHA_API_KEY = process.env.WAHA_API_KEY;

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
      body: JSON.stringify({ chatId: phone, text: message, session: 'Financiia' }),
      // body: JSON.stringify({ chatId: phone, text: message, session: 'Financiia', reply_to: previousMessage }),
    });

    await fetch(`${WAHA_BASE_URL}/stopTyping`, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': `${WAHA_API_KEY}`,
      },
      method: 'POST',
      body: JSON.stringify({ chatId: phone, session: 'Financiia' }),
    });

    return response.json().then((res) => res.key?.id);
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

  async sendMessageWithButtons(
    previousMessage: string | null,
    phone: string,
    buttons: { type: string; text: string; copyCode?: string }[],
    header?: string,
    body?: string,
    footer?: string,
  ) {
    await fetch(`${WAHA_BASE_URL}/sendButtons`, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': `${WAHA_API_KEY}`,
      },
      method: 'POST',
      body: JSON.stringify({
        header: header,
        body: body,
        footer: footer,
        session: 'Financiia',
        chatId: phone,
        buttons: buttons,
      }),
    });
  }

  async getContactInfo(phone: string) {
    const response = await fetch(`${WAHA_BASE_URL}/contacts?contactId=${phone}&session=Financiia`, {
      headers: { 'X-API-KEY': `${WAHA_API_KEY}` },
      method: 'GET',
    });
    return response.json();
  }

  async getMessages(phone: string) {
    const response = await fetch(`${WAHA_BASE_URL}/Financiia/chats/${phone}/messages`, {
      headers: { 'X-API-KEY': `${WAHA_API_KEY}` },
      method: 'GET',
    });
    return response.json();
  }

  async getMessage(phone: string, messageId: string) {
    const response = await fetch(`${WAHA_BASE_URL}/Financiia/chats/${phone}/messages/${messageId}`, {
      headers: { 'X-API-KEY': `${WAHA_API_KEY}` },
      method: 'GET',
    });
    return response.json();
  }
}
