import { PricingTier } from '@/constants/pricing-tier';
import { FeaturesList } from '@/components/home/pricing/features-list';
import { cn } from '@/lib/utils';
import { PriceTitle } from '@/components/home/pricing/price-title';
import { Separator } from '@/components/ui/separator';
import { FeaturedCardGradient } from '@/components/gradients/featured-card-gradient';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-7xl relative px-[32px] flex flex-col items-center justify-between">
      {/* <Toggle frequency={frequency} setFrequency={setFrequency} /> */}
      <h1 className={'text-[40px] leading-[40px] md:text-[60px] md:leading-[60px] tracking-[-1.6px] font-medium mb-4'}>
        Planos
      </h1>
      <div className="isolate mx-auto grid grid-cols-1 gap-8 lg:mx-0 lg:max-w-none lg:grid-cols-1">
        {PricingTier.map((tier) => (
          <div
            key={tier.id}
            className={cn(
              'rounded-lg bg-background/70 backdrop-blur-[6px] overflow-hidden border-border border-2 shadow-2xl',
            )}
          >
            <div className={cn('flex gap-5 flex-col rounded-lg rounded-b-none')}>
              {tier.featured && <FeaturedCardGradient />}
              <PriceTitle tier={tier} />
              <div className="md:mt-6 flex flex-col px-4 md:px-8">
                <div className={cn('text-5xl md:text-[80px] md:leading-[96px] tracking-[-1.6px] font-medium')}>
                  R$ {tier.price.toFixed(2)}
                </div>
              </div>
              <div className={'px-4 md:px-8'}>
                <Separator className={'bg-border'} />
              </div>
              <div className={'px-4 md:px-8 text-[16px] leading-[24px]'}>{tier.description}</div>
            </div>
            <div className={'px-4 md:px-8 mt-8'}>
              <Link href={'/signup'}>
                <Button variant={'default'} className="w-full">
                  Contratar
                </Button>
              </Link>
            </div>
            <div className={'px-4 md:px-8 mt-4'}>
              <Separator className={'bg-border'} />
            </div>
            <FeaturesList tier={tier} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function StripeButton() {
  const onClick = async () => {
    const response = await fetch('/api/stripe/checkout', {
      method: 'POST',
      body: JSON.stringify({ priceId: 'price_1RLQMPPGjwv1HAuwRuvVQK6t' }),
    });
    const data = await response.json();
    window.location.href = data.session.url;
  };
  return (
    <button id="checkout-button" type="button" onClick={onClick}>
      Checkout
    </button>
  );
}
