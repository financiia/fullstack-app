import { createCheckoutSession } from '@/utils/stripe/server';
import CompleteRegistrationComponent from './client';

export default async function CompleteRegistrationPage() {
  const session = await createCheckoutSession();

  if (!session.url) {
    return <div>Erro ao criar sessão</div>;
  }

  return <CompleteRegistrationComponent stripeLink={session.url} />;
}
