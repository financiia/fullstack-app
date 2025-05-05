import Link from 'next/link';
import Image from 'next/image';
import { ReactNode } from 'react';
import { DashboardGradient } from '@/components/gradients/dashboard-gradient';
import '../../../styles/dashboard.css';
import { Sidebar } from '@/components/dashboard/layout/sidebar';
import { SidebarUserInfo } from '@/components/dashboard/layout/sidebar-user-info';
import { getActiveSubscription } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

interface Props {
  children: ReactNode;
}

export async function DashboardLayout({ children }: Props) {
  const { subscription, error } = await getActiveSubscription();
  const trialEnd = Math.floor((subscription?.trial_end ?? 0) / (1000 * 60 * 60 * 24));
  return (
    <div className="min-h-screen w-full flex flex-col">
      {error && (
        <div className="w-full py-2 bg-red-500 text-white text-center flex items-center justify-center font-bold">
          {error}
          <Link href="/dashboard/billing">
            <Button variant={'outline'} size={'sm'} className="ml-2 text-black">
              Regularize agora <ArrowRight />
            </Button>
          </Link>
        </div>
      )}
      {subscription?.status === 'trialing' && (
        <div
          className={`w-full py-2 ${trialEnd > 5 ? 'bg-yellow-500' : 'bg-red-500'} text-white text-center flex items-center justify-center font-bold`}
        >
          Seu teste grátis acaba em {trialEnd} dias
        </div>
      )}
      <div className="grid flex-grow-1 w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr] relative overflow-hidden">
        <DashboardGradient />
        <div className="hidden border-r md:block relative">
          <div className="flex h-full flex-col gap-2">
            <div className="flex items-center pt-8 pl-6 pb-10">
              <Link href="/" className="flex items-center gap-2 font-semibold">
                <Image src={'/assets/icons/logo/aeroedit-logo-icon.svg'} alt={'AeroEdit'} width={41} height={41} />
              </Link>
            </div>
            <div className="flex flex-col grow">
              <Sidebar />
              <SidebarUserInfo />
            </div>
          </div>
        </div>
        <div className="flex flex-col">{children}</div>
      </div>
    </div>
  );
}
