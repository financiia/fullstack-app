// npm install @mercadopago/sdk-react

import MercadoPagoConfig, { Preference } from 'mercadopago';

const client = new MercadoPagoConfig({
  accessToken: 'APP_USR-2971915759247248-050313-3c83b19bade5aad17dd28fa3578efe7d-2418377281',
});

const preference = new Preference(client);
preference
  .create({
    body: {
      items: [
        {
          id: 'basic2',
          title: 'basic2',
          quantity: 1,
          unit_price: 12.9,
        },
      ],
      back_urls: {
        success: 'https://f334-2804-29b8-5161-fda9-d9d4-1a28-48ba-b7db.ngrok-free.app/billing/success',
        failure: 'https://f334-2804-29b8-5161-fda9-d9d4-1a28-48ba-b7db.ngrok-free.app/billing/failure',
        pending: 'https://f334-2804-29b8-5161-fda9-d9d4-1a28-48ba-b7db.ngrok-free.app/billing/pending',
      },
      auto_return: 'approved',
    },
  })
  .then(console.log)
  .catch(console.log);
