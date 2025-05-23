import { PricingTier } from '@/constants/pricing-tier';
import { IBillingFrequency } from '@/constants/billing-frequency';
import { FeaturesList } from '@/components/home/pricing/features-list';
import { PriceAmount } from '@/components/home/pricing/price-amount';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PriceTitle } from '@/components/home/pricing/price-title';
import { Separator } from '@/components/ui/separator';
import { FeaturedCardGradient } from '@/components/gradients/featured-card-gradient';
import Link from 'next/link';
import { MercadoPago } from './mercado-pago';

export function PriceCards() {
  return (
    <div className="isolate mx-auto grid grid-cols-1 gap-8 lg:mx-0 lg:max-w-none lg:grid-cols-1">
      {PricingTier.map((tier) => (
        <div key={tier.id} className={cn('rounded-lg bg-background/70 backdrop-blur-[6px] overflow-hidden')}>
          <div className={cn('flex gap-5 flex-col rounded-lg rounded-b-none pricing-card-border')}>
            {tier.featured && <FeaturedCardGradient />}
            <PriceTitle tier={tier} />
            <PriceAmount loading={false} tier={tier} priceSuffix={'R$'} />
            <div className={'px-8'}>
              <Separator className={'bg-border'} />
            </div>
            <div className={'px-8 text-[16px] leading-[24px]'}>{tier.description}</div>
          </div>
          <div className={'px-8 mt-8'}>
            {/* <Button className={'w-full'} variant={'secondary'} asChild={true}>
              <Link href={`/checkout/${tier.priceId[frequency.value]}`}>Get started</Link>
            </Button> */}
            <MercadoPago tier={tier} />
            {/* <Wallet key={tier.id} initialization={{preferenceId: tier.priceId}} /> */}
          </div>
          <FeaturesList tier={tier} />
        </div>
      ))}
    </div>
  );
}
