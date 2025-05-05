import { Button } from '@/components/ui/button';
import Image from 'next/image';

export function HeroSection() {
  return (
    <section className={'mx-auto max-w-7xl px-[32px] relative flex items-center justify-between mt-6 mb-12'}>
      <div className={'text-center w-full flex flex-col items-center justify-center'}>
        <h1 className={'text-[48px] leading-[48px] md:text-[80px] md:leading-[80px] tracking-[-1.6px] font-medium'}>
          Organize suas finanças
          <br />
          com a FinanciIA
        </h1>
        <p className={'mt-6 text-[18px] leading-[27px] md:text-[20px] md:leading-[30px]'}>
          Converse com a Marill.IA direto pelo WhatsApp e deixe que ela te ajude a organizar suas finanças!
        </p>

        {/* <div className={cn('rounded-lg bg-background/70 backdrop-blur-[6px] overflow-hidden')}>
          <div className={cn('flex gap-5 flex-col rounded-lg rounded-b-none pricing-card-border')}>
            titulo quantidade
            <div className={'px-8'}>
              <Separator className={'bg-border'} />
            </div>
            <div className={'px-8 text-[16px] leading-[24px]'}>descripi</div>
          </div>
        </div> */}
        <div className={'w-full flex flex-row items-center justify-center gap-10 mt-5'}>
          <div className={'align-middle rounded-2xl overflow-hidden border-border border-2 shadow-2xl'}>
            <Image
              className="w-auto block "
              src={'/assets/marillia/transacoes.jpeg'}
              alt={'Marillia'}
              width={200}
              height={200}
            />
          </div>
          <div className={'align-middle rounded-2xl overflow-hidden'}>
            <Image
              className="w-auto block"
              src={'/assets/marillia/transacoes.jpeg'}
              alt={'Marillia'}
              width={200}
              height={200}
            />
          </div>
        </div>

        <Button className={'mt-5'}>Experimente grátis por 30 dias!</Button>
      </div>
    </section>
  );
}
