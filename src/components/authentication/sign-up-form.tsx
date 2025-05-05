'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { AuthenticationForm } from '@/components/authentication/authentication-form';
import { signup, verify } from '@/app/signup/actions';
import { useToast } from '@/components/ui/use-toast';

import { Label } from '@/components/ui/label';
import { redirect } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { OtpInput } from 'reactjs-otp-input';
import Link from 'next/link';

export function SignupForm() {
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showOTP, setShowOTP] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  const onlyNumbers = phone.replace(/\D/g, '');
  const enableVerify = onlyNumbers.length === 11;

  function handleSignup() {
    console.log('handleSignup', onlyNumbers);
    setIsLoading(true);
    signup({ phone: onlyNumbers }).then((data) => {
      if (data?.error) {
        toast({ description: 'Something went wrong. Please try again', variant: 'destructive' });
      } else {
        setShowOTP(true);
      }
      setIsLoading(false);
    });
  }

  async function handleVerify(newOtp?: string) {
    setIsLoading(true);
    verify({ phone: onlyNumbers, otp: newOtp ?? otp }).then((data) => {
      if (data?.error) {
        toast({ description: 'Something went wrong. Please try again', variant: 'destructive' });
        setError(data.error);
      } else {
        if (data?.isFirstLogin) {
          // toast({ description: 'Verificação realizada com sucesso!', variant: 'default' });
          redirect('/signup/complete_registration');
        } else {
          toast({ description: 'Verificação realizada com sucesso!', variant: 'default' });
          redirect('/dashboard');
        }
      }
      setIsLoading(false);
    });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <form className="w-full max-w-md flex flex-col items-center justify-center md:border-border md:border-2 md:rounded-xl p-4 md:shadow-2xl">
        <Link href={'/'}>
          <Image src={'/logo-fundo-claro.png'} alt={'AeroEdit'} width={60} height={60} className="mb-4" />
        </Link>
        <div className={'text-[30px] leading-[16px] font-medium tracking-[-0.6px] text-center mb-4 not-md:text-xl'}>
          Entrar usando WhatsApp
        </div>
        <AuthenticationForm phone={phone} onPhoneChange={(phone) => setPhone(phone)} />
        {showOTP && (
          <div className="grid w-full max-w-sm items-center gap-1.5 mt-1 mb-4">
            <Label className={'text-muted-foreground leading-5 text-center text-md mt-1'} htmlFor="phone">
              Código de verificação
            </Label>
            <OtpInput
              value={otp}
              onChange={(e) => {
                setOtp(e);
                if (e.length === 6) {
                  handleVerify(e);
                }
              }}
              numInputs={6}
              separator={<span className="mx-1"></span>}
              containerStyle="justify-center"
              isInputNum={true}
              inputStyle="border-border rounded-xs border-2 min-w-[30px] text-center py-1"
              hasErrored={error}
              errorStyle="border-destructive"
            />
          </div>
        )}
        {!showOTP ? (
          <Button
            formAction={() => handleSignup()}
            type={'submit'}
            variant={'default'}
            className={'mt-4 w-full'}
            disabled={!enableVerify}
          >
            {isLoading ? (
              <div className={'flex items-center justify-center'}>
                <Loader2 className={'w-4 h-4 mr-2 animate-spin'} />
                Enviando código...
              </div>
            ) : (
              'Enviar código'
            )}
          </Button>
        ) : (
          <Button formAction={() => handleVerify()} type={'submit'} variant={'default'} className={'w-full'}>
            {isLoading ? (
              <div className={'flex items-center justify-center'}>
                <Loader2 className={'w-4 h-4 mr-2 animate-spin'} />
                Verificando...
              </div>
            ) : (
              'Entrar'
            )}
          </Button>
        )}
      </form>
    </div>
  );
}
