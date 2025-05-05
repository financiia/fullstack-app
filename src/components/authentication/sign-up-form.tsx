'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { AuthenticationForm } from '@/components/authentication/authentication-form';
import { signup, verify } from '@/app/signup/actions';
import { useToast } from '@/components/ui/use-toast';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { redirect } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { OtpInput } from 'reactjs-otp-input';

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
        toast({ description: 'Verificação realizada com sucesso!', variant: 'default' });
        redirect('/dashboard');
      }
      setIsLoading(false);
    });
  }

  return (
    <form action={'#'} className={'px-6 md:px-16 pb-6 py-8 gap-6 flex flex-col items-center justify-center'}>
      <Image src={'/assets/icons/logo/aeroedit-icon.svg'} alt={'AeroEdit'} width={80} height={80} />
      <div className={'text-[30px] leading-[36px] font-medium tracking-[-0.6px] text-center'}>
        Entrar usando WhatsApp
      </div>
      <AuthenticationForm phone={phone} onPhoneChange={(phone) => setPhone(phone)} />
      {showOTP && (
        <div className="grid w-full max-w-sm items-center gap-1.5 mt-1">
          <Label className={'text-muted-foreground leading-5 text-center'} htmlFor="phone">
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
            inputStyle="border-border rounded-xs border-2 min-w-[25px] text-center"
            hasErrored={error}
            errorStyle="border-destructive"
          />
          {/* <Input
            className={'border-border rounded-xs'}
            type="phone"
            id="phone"
            autoComplete={'username'}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          /> */}
        </div>
      )}
      {!showOTP ? (
        <Button
          formAction={() => handleSignup()}
          type={'submit'}
          variant={'default'}
          className={'w-full'}
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
  );
}
