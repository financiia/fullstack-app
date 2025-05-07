'use client';

import { Separator } from '@/components/ui/separator';
import { LogOut } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { MouseEvent, useContext } from 'react';
import { UserContext } from '@/app/dashboard/user-context';

export function SidebarUserInfo() {
  const supabase = createClient();
  const user = useContext(UserContext);

  async function handleLogout(e: MouseEvent) {
    e.preventDefault();
    await supabase.auth.signOut();
    location.reload();
  }

  function formatPhoneNumber(phoneNumber: string) {
    return phoneNumber.slice(2, 13).replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }

  return (
    <div className={'flex flex-col items-start md:pb-8 px-2 text-sm font-medium lg:px-4'}>
      <Separator className={'relative mt-6 dashboard-sidebar-highlight bg-[#283031]'} />
      <div className={'flex w-full flex-row mt-6 items-center justify-between'}>
        <div className={'flex flex-col items-start justify-center overflow-hidden text-ellipsis'}>
          <div className={'text-sm leading-5 font-semibold w-full overflow-hidden text-ellipsis'}>{user?.nickname}</div>
          <div className={'text-sm leading-5 text-muted-foreground w-full overflow-hidden text-ellipsis'}>
            {formatPhoneNumber(user?.whatsapp_phone || '')}
          </div>
        </div>
        <div>
          <LogOut onClick={handleLogout} className={'h-6 w-6 text-muted-foreground cursor-pointer'} />
        </div>
      </div>
    </div>
  );
}
