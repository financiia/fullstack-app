import { Alert } from '@/components/ui/alert';
import dayjs from 'dayjs';
import Stripe from 'stripe';

interface Props {
  subscription: Stripe.Subscription;
}
export function SubscriptionAlerts({ subscription }: Props) {
  if (subscription.status === 'canceled') {
    return (
      <Alert variant={'destructive'} className={'mb-10'}>
        This subscription was canceled on {dayjs(subscription.canceled_at).format('MMM DD, YYYY [at] h:mma')} and is no
        longer active.
      </Alert>
    );
  } else if (subscription.pending_update?.expires_at) {
    return (
      <Alert className={'mb-10'}>
        This subscription is scheduled to be canceled on{' '}
        {dayjs(subscription.pending_update?.expires_at).format('MMM DD, YYYY [at] h:mma')}
      </Alert>
    );
  }
  return null;
}
