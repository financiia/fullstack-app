'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeftIcon } from 'lucide-react';
import { useState } from 'react';

export default function CompleteRegistrationPage() {
  const [step, setStep] = useState(1);
  const [nickname, setNickname] = useState('');
  const [plan, setPlan] = useState('basic');

  const onClick = async () => {
    const response = await fetch('/api/stripe/checkout', {
      method: 'POST',
      body: JSON.stringify({ priceId: 'price_1RLQMPPGjwv1HAuwRuvVQK6t', nickname }),
    });
    const data = await response.json();
    window.location.href = data.session.url;
  };

  fetch('/api/stripe/invoices')
    .then((res) => res.json())
    .then((data) => {
      console.log(data);
    });

  return (
    <div>
      <form className="min-h-screen bg-background flex flex-col items-center justify-center not-md:justify-start not-md:pt-5 px-4">
        <div className="w-full max-w-md">
          {/* Progress bar */}
          <div className="w-full bg-border rounded-full h-2 md:mb-8">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: step === 1 ? '33%' : '66%' }}
            />
          </div>

          {/* Step 1: Nickname */}
          <div
            className="bg-background/80 backdrop-blur-[6px] md:border-2 md:border-border md:rounded-lg p-5 md:p-8 mb-4 transition-all duration-300"
            style={{ display: step === 1 ? 'block' : 'none' }}
          >
            <h2 className="text-2xl font-medium mb-6">Como devemos te chamar?</h2>
            <Input
              type="text"
              placeholder="Seu apelido"
              className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
            <Button
              className="w-full mt-6 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-6 py-3 transition-colors"
              formAction={() => setStep(2)}
              type={'submit'}
            >
              Continuar
            </Button>
          </div>

          {/* Step 2: Plan Selection */}
          <div
            className="bg-background/80 backdrop-blur-[6px] md:border-2 md:border-border md:rounded-lg p-5 px-2 md:p-8 transition-all duration-300"
            style={{ display: step === 2 ? 'block' : 'none' }}
          >
            <div className="flex justify-start items-center gap-2 mb-6">
              <Button variant="ghost" size="icon" onClick={() => setStep(1)}>
                <ArrowLeftIcon className="w-4 h-4" />
              </Button>
              <h2 className="text-2xl font-medium">Escolha seu plano</h2>
            </div>

            <div className="space-y-4">
              <div
                className={`relative border-2 rounded-lg p-4 cursor-pointer hover:border-primary transition-colors border-primary`}
                onClick={() => setPlan('basic')}
              >
                <div className="absolute top-0 right-0 bg-primary text-xs text-primary-foreground px-2 py-1 rounded-lg">
                  Popular
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">Plano Básico</h3>
                    <p className="text-muted-foreground">R$ 5,90/mês</p>
                    <p className="text-white bg-green-700 rounded-lg px-2 py-0 mt-1">30 dias grátis</p>
                  </div>
                  <div className="h-4 w-4 rounded-full bg-primary" />
                </div>
              </div>

              <div
                className={`border-2 rounded-lg p-4 cursor-pointer overflow-hidden border-${plan === 'pro' ? 'primary' : 'border'}`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">Plano Pro (em breve)</h3>
                    <p className="text-muted-foreground">R$ 19,90/mês</p>
                  </div>
                  <div className="h-4 w-4 rounded-full border-2 border-border" />
                </div>
              </div>
            </div>

            <Button
              onClick={onClick}
              type="button"
              className="w-full mt-6 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-6 py-3 transition-colors"
            >
              Finalizar cadastro
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
