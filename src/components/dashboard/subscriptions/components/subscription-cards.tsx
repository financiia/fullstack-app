import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Status } from '@/components/shared/status/status';
import { cn } from '@/lib/utils';
import { parseMoney } from '@/utils/paddle/parse-money';
import Stripe from 'stripe';

interface Props {
  subscriptions: Stripe.Subscription[];
  className: string;
}

export function SubscriptionCards({ subscriptions, className }: Props) {
  if (subscriptions.length === 0) {
    return <span className={'text-base font-medium'}>No active subscriptions</span>;
  } else {
    return (
      <div className={cn('grid flex-1 items-start', className)}>
        {subscriptions.map((subscription) => {
          const subscriptionItem = subscription.items.data[0];
          const price = subscriptionItem.price.unit_amount!;
          const formattedPrice = parseMoney(price.toString(), subscription.currency);
          // const frequency =
          //   subscription.plan.interval_count === 1
          //     ? `/${subscription.plan.interval}`
          //     : `every ${subscription.plan.interval_count} ${subscription.plan.interval}s`;
          const frequency = 'every 1 month';
          return (
            <Card key={subscription.id} className={'bg-background/50 backdrop-blur-[24px] border-border p-6'}>
              <CardHeader className="p-0 space-y-0">
                <CardTitle className="flex flex-col justify-between items-start mb-6">
                  <div
                    className={cn('flex mb-4 w-full', {
                      // 'justify-between': subscriptionItem.product.imageUrl,
                      // 'justify-end': !subscriptionItem.product.imageUrl,
                    })}
                  >
                    <Link href={`/dashboard/subscriptions/${subscription.id}`}>
                      <ArrowRight size={20} />
                    </Link>
                  </div>
                  <span className={'text-xl leading-7 font-medium'}>{subscriptionItem.plan.nickname}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className={'p-0 flex justify-between gap-3 flex-wrap xl:flex-nowrap'}>
                <div className={'flex flex-col gap-3'}>
                  <div className="text-base leading-6 text-secondary">{subscriptionItem.plan.nickname}</div>
                  <div className="text-base leading-[16px] text-primary">
                    {formattedPrice}
                    {frequency}
                  </div>
                </div>
                <Status status={subscription.status} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }
}
