import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
// @ts-ignore
import TelefoneBrasileiroInput from 'react-telefone-brasileiro';
import { cn } from '@/lib/utils';

interface Props {
  phone: string;
  onPhoneChange: (phone: string) => void;
}

export function AuthenticationForm({ phone, onPhoneChange }: Props) {
  return (
    <>
      <div className="grid w-full max-w-sm items-center gap-1.5 mt-2">
        <Label className={'text-muted-foreground leading-5'} htmlFor="phone">
          Telefone
        </Label>
        <TelefoneBrasileiroInput
          value={phone}
          onChange={(e: any) => onPhoneChange(e.target.value)}
          temDDD={true}
          placeholder={'(DDD) 99999-9999'}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            'border-border rounded-xs',
          )}
        />
      </div>
    </>
  );
}
