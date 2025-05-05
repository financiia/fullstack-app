import { ArrowDown, Bolt, Image, Shapes, Timer } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/utils/supabase/server';
import { capitalize, sum } from 'lodash';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DashboardPageHeader } from '@/components/dashboard/layout/dashboard-page-header';

export default function HistoryPage() {
  return <HistoryTable />;
}

type Transaction = {
  id: string;
  valor: number;
  data: string;
  descricao: string;
  categoria: string;
};
async function HistoryTable() {
  // Use o supabase para pegar os dados das transações
  const supabase = await createClient();
  const { data: transactions, error } = await supabase.from('transactions').select('*');
  transactions?.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  return (
    <div className="container mx-auto py-8 px-4">
      <DashboardPageHeader pageTitle={'Histórico de Transações'} />
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden md:table-cell">Categoria</TableHead>
              <TableHead className="md:hidden">Cat.</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead className="hidden md:table-cell">Descrição</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions?.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell className="hidden md:table-cell">{capitalize(transaction.categoria)}</TableCell>
                <TableCell className="md:hidden">{capitalize(transaction.categoria)}</TableCell>
                <TableCell>
                  <span className="md:hidden">
                    {new Date(transaction.data).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </span>
                  <span className="hidden md:inline">
                    {new Date(transaction.data).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </TableCell>
                <TableCell>R$ {transaction.valor}</TableCell>
                <TableCell className="hidden md:table-cell">{transaction.descricao}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} className="hidden md:table-cell">
                Total: R$ {sum(transactions?.map((transaction) => transaction.valor))}
              </TableCell>
              <TableCell colSpan={2} className="md:hidden">
                Total: R$ {sum(transactions?.map((transaction) => transaction.valor))}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                Mostrando 1 até {transactions?.length} de {transactions?.length} transações
              </TableCell>
              <TableCell className="md:hidden">{transactions?.length} transações</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
