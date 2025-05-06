'use server';

import { ArrowDown, Bolt, Shapes } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/utils/supabase/server';
import { sum } from 'lodash';
import Charts from './charts';

export async function DashboardUsageCardGroup() {
  // Use o supabase para pegar os dados das transações
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: transactions } = await supabase.from('transactions').select('*').eq('user_id', user?.id);
  // console.log(transactions);

  const cards = [
    {
      title: 'Transações realizadas',
      icon: <Bolt className={'text-[#4B4F4F]'} size={18} />,
      value: `R$ ${sum(transactions?.map((transaction) => transaction.valor)).toFixed(2)}`,
      change: `${transactions?.length} transações`,
    },
    {
      title: 'Média mensal',
      icon: <Shapes className={'text-[#4B4F4F]'} size={18} />,
      value: `R$ ${sum(transactions?.map((transaction) => transaction.valor)).toFixed(2)}`,
      change: `${transactions?.length} transações`,
    },
    // {
    //   title: 'Gastos por seção',
    //   // eslint-disable-next-line jsx-a11y/alt-text
    //   icon: <Image className={'text-[#4B4F4F]'} size={18} />,
    //   value: 'R$ 1.247,32',
    //   change: 'Alimentação',
    // }
  ];

  const currentMonthSpendings = transactions?.filter((transaction) => {
    const transactionDate = new Date(transaction.data);
    return Math.abs(transactionDate.getTime() - new Date().getTime()) < 30 * 24 * 60 * 60 * 1000;
  });

  const lastMonthSpendings = transactions?.filter((transaction) => {
    const transactionDate = new Date(transaction.data);
    return (
      transactionDate.getMonth() === new Date().getMonth() - 1 &&
      transactionDate.getFullYear() === new Date().getFullYear()
    );
  });

  const lastMonthSpendingsValue = sum(lastMonthSpendings?.map((transaction) => transaction.valor));
  const currentMonthSpendingsValue = sum(currentMonthSpendings?.map((transaction) => transaction.valor));
  const percentageChange =
    lastMonthSpendingsValue > 0
      ? ((currentMonthSpendingsValue - lastMonthSpendingsValue) / lastMonthSpendingsValue) * 100
      : 0;

  return (
    <div className={'grid gap-6 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2'}>
      <Card className={'bg-background/50 backdrop-blur-[24px] border-border p-6'}>
        <CardHeader className="p-0 space-y-0">
          <CardTitle className="flex justify-between items-center mb-6">
            <span className={'text-base leading-4'}>Últimos 30 dias</span>
          </CardTitle>
          <div className={'flex items-center justify-between'}>
            <CardDescription className={'text-[32px] leading-[32px] text-primary'}>
              R$ {currentMonthSpendingsValue.toFixed(2)}
            </CardDescription>
            <div
              className={
                'text-[24px] leading-[24px] text-green-500 flex items-center border-2 border-green-500 rounded-md px-2 py-1'
              }
            >
              {percentageChange.toFixed(2)}% <ArrowDown className={'w-6 h-6 display-inline'} />
            </div>
          </div>
        </CardHeader>
        <CardContent className={'p-0'}>
          <div className="text-sm leading-[14px] pt-2 text-secondary">{currentMonthSpendings?.length} transações</div>
        </CardContent>
      </Card>

      {cards.map((card) => (
        <Card key={card.title} className={'bg-background/50 backdrop-blur-[24px] border-border p-6'}>
          <CardHeader className="p-0 space-y-0">
            <CardTitle className="flex justify-between items-center mb-6">
              <span className={'text-base leading-4'}>{card.title}</span> {card.icon}
            </CardTitle>
            <CardDescription className={'text-[32px] leading-[32px] text-primary'}>{card.value}</CardDescription>
          </CardHeader>
          <CardContent className={'p-0'}>
            <div className="text-sm leading-[14px] pt-2 text-secondary">{card.change}</div>
          </CardContent>
        </Card>
      ))}

      {transactions && <Charts transactions={transactions} />}
    </div>
  );
}
