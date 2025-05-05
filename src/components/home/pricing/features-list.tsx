import { Tier } from '@/constants/pricing-tier';
import { CircleCheck } from 'lucide-react';

interface Props {
  tier: Tier;
}

export function FeaturesList({ tier }: Props) {
  return (
    <ul className={'p-4 md:p-8 flex flex-col gap-3 items-start'}>
      {tier.features.map((feature: string) => (
        <li key={feature} className="flex gap-x-2 items-center">
          <div className="w-[24px]">
            <CircleCheck className={'h-6 w-6 text-muted-foreground'} />
          </div>
          <span className={'text-base'}>{feature}</span>
        </li>
      ))}
    </ul>
  );
}
