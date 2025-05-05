import { DashboardPageHeader } from '@/components/dashboard/layout/dashboard-page-header';
import { Button } from '@/components/ui/button';
import { createUserPortal } from '../actions';
import Link from 'next/link';

export default async function BillingPage() {
  const { url } = await createUserPortal();
  return (
    <div className="container mx-auto py-2 md:py-8 px-4">
      <DashboardPageHeader pageTitle={'Faturamento'} />
      <div className="overflow-x-auto">
        <p className="text-sm text-muted-foreground mb-4">
          Todos os detalhes de faturamento podem ser conferidos acessando o painel abaixo.
        </p>
        {url ? (
          <Link href={url}>
            <Button>Seguir para o painel de faturamento</Button>
          </Link>
        ) : (
          <Button>Erro ao criar o painel de faturamento</Button>
        )}
      </div>
    </div>
  );
}
