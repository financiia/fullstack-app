'use client';

import { PriceSection } from '@/components/checkout/price-section';
import { CheckoutFormGradients } from '@/components/gradients/checkout-form-gradients';
import { type Environments, initializePaddle, type Paddle } from '@paddle/paddle-js';
import type { CheckoutEventsData } from '@paddle/paddle-js/types/checkout/events';
import throttle from 'lodash.throttle';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { initMercadoPago, Payment, Wallet } from '@mercadopago/sdk-react';
import { createSubscription } from '@/app/checkout/actions';
import { Button } from '../ui/button';
initMercadoPago('APP_USR-e70c3ce7-4c9b-49d7-94ee-770ddc020c80');

interface PathParams {
  priceId: string;
  [key: string]: string | string[];
}

interface Props {
  userEmail?: string;
}

export function CheckoutContents({ userEmail }: Props) {
  const { priceId } = useParams<PathParams>();
  // const [quantity, setQuantity] = useState<number>(1);
  // const [paddle, setPaddle] = useState<Paddle | null>(null);
  // const [checkoutData, setCheckoutData] = useState<CheckoutEventsData | null>(null);

  // const handleCheckoutEvents = (event: CheckoutEventsData) => {
  //   setCheckoutData(event);
  // };

  // const updateItems = useCallback(
  //   throttle((paddle: Paddle, priceId: string, quantity: number) => {
  //     paddle.Checkout.updateItems([{ priceId, quantity }]);
  //   }, 1000),
  //   [],
  // );

  // useEffect(() => {
  //   if (!paddle?.Initialized && process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN && process.env.NEXT_PUBLIC_PADDLE_ENV) {
  //     initializePaddle({
  //       token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
  //       environment: process.env.NEXT_PUBLIC_PADDLE_ENV as Environments,
  //       eventCallback: (event) => {
  //         if (event.data && event.name) {
  //           handleCheckoutEvents(event.data);
  //         }
  //       },
  //       checkout: {
  //         settings: {
  //           variant: 'one-page',
  //           displayMode: 'inline',
  //           theme: 'dark',
  //           allowLogout: !userEmail,
  //           frameTarget: 'paddle-checkout-frame',
  //           frameInitialHeight: 450,
  //           frameStyle: 'width: 100%; background-color: transparent; border: none',
  //           successUrl: '/checkout/success',
  //         },
  //       },
  //     }).then(async (paddle) => {
  //       if (paddle && priceId) {
  //         setPaddle(paddle);
  //         paddle.Checkout.open({
  //           ...(userEmail && { customer: { email: userEmail } }),
  //           items: [{ priceId: priceId, quantity: 1 }],
  //         });
  //       }
  //     });
  //   }
  // }, [paddle?.Initialized, priceId, userEmail]);

  // useEffect(() => {
  //   if (paddle && priceId && paddle.Initialized) {
  //     updateItems(paddle, priceId, quantity);
  //   }
  // }, [paddle, priceId, quantity, updateItems]);

  const initialization = {
    amount: 1,
    preferenceId: '2418377281-b8898942-4af0-4754-9132-f2befa9150db',
    externalReference: '1234567890',
  };

  return (
    <div
      className={
        'rounded-lg md:bg-background/80 md:backdrop-blur-[24px] md:p-10 md:pl-16 md:pt-16 md:min-h-[400px] flex flex-col justify-between relative'
      }
    >
      <CheckoutFormGradients />
      <div className={'flex flex-col md:flex-row gap-8 md:gap-16'}>
        <div className={'w-full md:w-[400px]'}>
          {/* <Wallet initialization={initialization} /> */}
          <Button onClick={() => createSubscription({ phone: userEmail! })}>Create Subscription</Button>
        </div>
        <div className={'min-w-[375px] lg:min-w-[535px]'}>
          <div className={'text-base leading-[20px] font-semibold mb-8'}>Payment details</div>
          <div className={'paddle-checkout-frame'} />
        </div>
      </div>
    </div>
  );
}
