'use client';

import * as Highcharts from 'highcharts';
import { HighchartsReact } from 'highcharts-react-official';
import { capitalize, groupBy, sum } from 'lodash';

type Transaction = {
  id: string;
  valor: number;
  data: string;
  descricao: string;
  categoria: string;
};

export default function Charts({ transactions }: { transactions: Transaction[] }) {
  const total = sum(transactions.map((transaction) => transaction.valor));
  const groupedTransactions = Object.entries(groupBy(transactions, 'categoria')).map(
    ([category, groupTransactions]) => ({
      category,
      percentage: (100 * sum(groupTransactions.map((transaction) => transaction.valor))) / total,
    }),
  );

  groupedTransactions.sort((a, b) => b.percentage - a.percentage);

  const options: Highcharts.Options = {
    chart: {
      type: 'pie',
      margin: 10,
    },
    title: {
      text: 'Gastos por categoria',
    },
    tooltip: {
      valueSuffix: '%',
    },
    yAxis: {
      enabled: false,
    },
    plotOptions: {
      pie: {
        allowPointSelect: true,
        cursor: 'pointer',
        showInLegend: true,
        dataLabels: [
          {
            enabled: false,
            distance: 20,
          },
          {
            enabled: true,
            distance: -60,
            format: '{point.y:.0f}%',
            style: {
              fontSize: '1.2em',
              textOutline: 'none',
              opacity: 0.7,
            },
            filter: {
              operator: '>',
              property: 'y',
              value: 10,
            },
          },
        ],
      },
    },
    series: [
      {
        name: 'Gastos',
        colorByPoint: true,
        data: groupedTransactions.map(({ category, percentage }, index) => ({
          name: capitalize(category),
          y: percentage,
          selected: index === 0,
          sliced: index === 0,
        })),
      } as any,
    ],
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
}
