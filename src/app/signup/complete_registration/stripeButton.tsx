import { Button } from '@/components/ui/button';
import { createCheckoutSession } from '@/utils/stripe/server';
import Link from 'next/link';

export default async function StripeButton() {
  const session = await createCheckoutSession();
  if (!session.url) {
    return <div>Erro ao criar sessão</div>;
  }
  return (
    <Link href={session.url}>
      <Button
        type="button"
        className="w-full mt-6 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-6 py-3 transition-colors"
      >
        Finalizar cadastro
      </Button>
    </Link>
  );
}
