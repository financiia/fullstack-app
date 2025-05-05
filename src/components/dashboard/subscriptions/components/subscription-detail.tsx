'use client';

import { getSubscription } from '@/utils/paddle/get-subscription';
import { getTransactions } from '@/utils/paddle/get-transactions';
import { SubscriptionPastPaymentsCard } from '@/components/dashboard/subscriptions/components/subscription-past-payments-card';
import { SubscriptionNextPaymentCard } from '@/components/dashboard/subscriptions/components/subscription-next-payment-card';
import { SubscriptionLineItems } from '@/components/dashboard/subscriptions/components/subscription-line-items';
import { SubscriptionHeader } from '@/components/dashboard/subscriptions/components/subscription-header';
import { Separator } from '@/components/ui/separator';
import { ErrorContent } from '@/components/dashboard/layout/error-content';
import { useEffect, useState } from 'react';
import { LoadingScreen } from '@/components/dashboard/layout/loading-screen';
import { SubscriptionDetailResponse, TransactionResponse } from '@/lib/api.types';
import Stripe from 'stripe';

interface Props {
  subscription: Stripe.Subscription;
}

export function SubscriptionDetail({ subscription }: Props) {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<TransactionResponse>();

  // useEffect(() => {
  //   (async () => {
  //     const [subscriptionResponse, transactionsResponse] = await Promise.all([
  //       getSubscription(subscriptionId),
  //       getTransactions(subscriptionId, ''),
  //     ]);

  //     if (subscriptionResponse) {
  //       setSubscription(subscriptionResponse);
  //     }

  //     if (transactionsResponse) {
  //       setTransactions(transactionsResponse);
  //     }
  //     setLoading(false);
  //   })();
  // }, [subscriptionId]);

  return (
    <>
      <div>
        <SubscriptionHeader subscription={subscription} />
        <Separator className={'relative bg-border mb-8 dashboard-header-highlight'} />
      </div>
      <div className={'grid gap-6 grid-cols-1 xl:grid-cols-6'}>
        <div className={'grid auto-rows-max gap-6 grid-cols-1 xl:col-span-2'}>
          {/* <SubscriptionNextPaymentCard transactions={transactions.data} subscription={subscription} />
          <SubscriptionPastPaymentsCard transactions={transactions.data} subscriptionId={subscriptionId} /> */}
        </div>
        <div className={'grid auto-rows-max gap-6 grid-cols-1 xl:col-span-4'}>
          {/* <SubscriptionLineItems subscription={subscription.data} /> */}
        </div>
      </div>
    </>
  );
}
