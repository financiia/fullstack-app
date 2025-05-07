import { Button } from '@/components/ui/button';
import Image from 'next/image';

export function HeroSection() {
  return (
    <section className={'mx-auto max-w-7xl px-[32px] relative flex items-center justify-between mt-6 mb-12'}>
      <div className={'text-center w-full flex flex-col items-center justify-center'}>
        <h1 className={'text-[40px] leading-[40px] md:text-[60px] md:leading-[60px] tracking-[-1.6px] font-medium'}>
          Organize suas finanças
          <br />
          com a FinanciIA
        </h1>
        <p className={'mt-2 md:mt-6 text-[18px] leading-[27px] md:text-[20px] md:leading-[30px]'}>
          Converse com a Marill.IA direto pelo WhatsApp e deixe que ela te ajude a organizar suas finanças!
        </p>

        <div className={'w-full mt-5'}>
          <div className={'flex-row items-center justify-center gap-10 md:flex hidden'}>
            <div className={'align-middle rounded-2xl overflow-hidden'}>
              <Image
                className="w-auto block"
                src={'/assets/marillia/transacoes.jpg'}
                alt={'Marillia'}
                width={300}
                height={300}
              />
            </div>
            <div className={'align-middle rounded-2xl overflow-hidden'}>
              <Image
                className="w-auto block"
                src={'/assets/marillia/transacoes.jpg'}
                alt={'Marillia'}
                width={300}
                height={300}
              />
            </div>
          </div>

          <div className="flex md:hidden overflow-x-auto snap-x snap-mandatory">
            <div className="flex-shrink-0 w-full snap-center flex justify-center">
              <div className={'align-middle rounded-2xl overflow-hidden'}>
                <Image
                  className="w-auto block"
                  src={'/assets/marillia/transacoes.jpg'}
                  alt={'Marillia'}
                  width={200}
                  height={200}
                />
              </div>
            </div>
            <div className="flex-shrink-0 w-full snap-center flex justify-center">
              <div className={'align-middle rounded-2xl overflow-hidden'}>
                <Image
                  className="w-auto block"
                  src={'/assets/marillia/transacoes.jpg'}
                  alt={'Marillia'}
                  width={200}
                  height={200}
                />
              </div>
            </div>
          </div>
        </div>

        <Button className={'mt-5'}>Experimente grátis por 30 dias!</Button>
      </div>
    </section>
  );
}
