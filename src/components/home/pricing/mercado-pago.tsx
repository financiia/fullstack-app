import { createSubscription } from '@/app/checkout/actions';
import { Button } from '@/components/ui/button';
import { Tier } from '@/constants/pricing-tier';
import { initMercadoPago, Payment, Wallet } from '@mercadopago/sdk-react';
import { useEffect, useState } from 'react';

initMercadoPago('APP_USR-e70c3ce7-4c9b-49d7-94ee-770ddc020c80');

export function MercadoPago({ tier }: { tier: Tier }) {
  const [initPoint, setInitPoint] = useState<string | null>(null);

  const handleCreateSubscription = async () => {
    const initPoint = await createSubscription({ phone: '5512981638494' });
    setInitPoint(initPoint);
  };

  return (
    // <Wallet initialization={{preferenceId: tier.priceId}} />
    <div>
      <a href={initPoint!} target="_blank" rel="noopener noreferrer">
        <Button onClick={handleCreateSubscription}>Assinar</Button>
      </a>
    </div>
  );
}
