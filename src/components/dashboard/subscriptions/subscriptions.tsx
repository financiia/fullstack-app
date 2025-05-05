import { SubscriptionDetail } from '@/components/dashboard/subscriptions/components/subscription-detail';
import { NoSubscriptionView } from '@/components/dashboard/subscriptions/views/no-subscription-view';
import { MultipleSubscriptionsView } from '@/components/dashboard/subscriptions/views/multiple-subscriptions-view';
import { SubscriptionErrorView } from '@/components/dashboard/subscriptions/views/subscription-error-view';
import { invoices } from '@/app/dashboard/actions';

export async function Subscriptions() {
  const { subscriptions, error } = await invoices();
  if (error || !subscriptions) {
    return <SubscriptionErrorView />;
  }
  if (subscriptions.length === 0) {
    return <NoSubscriptionView />;
  } else if (subscriptions.length === 1) {
    return <SubscriptionDetail subscription={subscriptions[0]} />;
  } else {
    // return <MultipleSubscriptionsView subscriptions={subscriptions} />;
  }
}
