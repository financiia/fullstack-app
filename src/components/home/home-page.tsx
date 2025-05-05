'use client';

import { createClient } from '@/utils/supabase/client';
import { useUserInfo } from '@/hooks/useUserInfo';
import '../../styles/home-page.css';
import Header from '@/components/home/header/header';
import { HeroSection } from '@/components/home/hero-section/hero-section';
import { Pricing } from '@/components/home/pricing/pricing';
import { Footer } from '@/components/home/footer/footer';
import { CircleCheck } from 'lucide-react';

export function HomePage() {
  const supabase = createClient();
  const { user } = useUserInfo(supabase);

  return (
    <div className="pb-10">
      <Header user={user} />

      <HeroSection />
      <FeaturesSection />
      <Pricing />
      <Footer />
    </div>
  );
}

function FeaturesSection() {
  return (
    <section
      id="features"
      className={'mx-auto max-w-7xl px-[32px] relative flex items-center justify-between mt-6 mb-12 bg-gray-300 p-10'}
    >
      <div className={'text-center w-full flex flex-col items-center justify-center'}>
        <h1 className={'text-[40px] leading-[40px] md:text-[60px] md:leading-[60px] tracking-[-1.6px] font-medium'}>
          Funcionalidades
        </h1>
        {/* Card grande com checkzinhos em várias funcionalidades */}
        <div className={'w-full flex flex-row items-center justify-center gap-10 mt-5'}>
          <div
            className={
              'flex flex-col items-start justify-center border-border border-2 rounded-lg p-8 shadow-2xl bg-white'
            }
          >
            <ul className={'flex flex-col gap-4'}>
              {[
                'Organização de transações direto pelo WhatsApp',
                'Aceita áudios e imagens',
                'Relatórios completos de gastos',
                'Gráficos e tendências de consumo',
                'Dashboard completo pelo navegador e aplicativo',
              ].map((feature) => (
                <li key={feature} className="flex gap-x-3">
                  <CircleCheck className={'h-6 w-6 text-muted-foreground'} />
                  <span className={'text-base'}>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
