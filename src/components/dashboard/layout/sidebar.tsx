'use client';

import { Album, CreditCard, History, Home } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const sidebarItems = [
  {
    title: 'Painel',
    icon: <Home className="h-6 w-6" />,
    href: '/dashboard',
  },
  {
    title: 'Faturamento',
    icon: <CreditCard className="h-6 w-6" />,
    href: '/dashboard/billing',
  },
  {
    title: 'Histórico',
    icon: <History className="h-6 w-6" />,
    href: '/dashboard/history',
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col grow justify-between items-start not-md:mt-3 md:px-2 text-sm font-medium lg:px-4">
      <div className={'w-full'}>
        {sidebarItems.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className={cn('flex items-center text-base gap-3 px-2 md:px-4 py-3 rounded-xxs dashboard-sidebar-items', {
              'dashboard-sidebar-items-active':
                item.href === '/dashboard' ? pathname === item.href : pathname.includes(item.href),
            })}
          >
            {item.icon}
            {item.title}
          </Link>
        ))}
      </div>
    </nav>
  );
}
