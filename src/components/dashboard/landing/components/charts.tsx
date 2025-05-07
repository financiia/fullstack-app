'use client';

import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import * as Highcharts from 'highcharts';
import { HighchartsReact } from 'highcharts-react-official';
import { capitalize, groupBy, sum } from 'lodash';
import React from 'react';

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
      total: sum(groupTransactions.map((transaction) => transaction.valor)),
    }),
  );

  groupedTransactions.sort((a, b) => b.percentage - a.percentage);

  const colors = [
    '#2caffe',
    '#544fc5',
    '#00e272',
    '#fe6a35',
    '#6b8abc',
    '#d568fb',
    '#2ee0ca',
    '#fa4b42',
    '#feb56a',
    '#91e8e1',
  ];

  const options: Highcharts.Options = {
    chart: {
      type: 'pie',
      marginLeft: 10,
      marginRight: 10,
      custom: {},
      backgroundColor: 'transparent',
      events: {
        render() {
          const chart = this,
            series = chart.series[0];
          let customLabel = chart.options.chart.custom.label;

          if (!customLabel) {
            customLabel = chart.options.chart.custom.label = chart.renderer
              .label('Total<br/>' + '<strong>R$ 1604.88</strong>')
              .css({
                color: '#000',
                textAnchor: 'middle',
              })
              .add();
          }

          const x = series.center[0] + chart.plotLeft,
            y = series.center[1] + chart.plotTop - customLabel.attr('height') / 2;

          customLabel.attr({
            x,
            y,
          });
          // Set font size based on chart diameter
          customLabel.css({
            fontSize: `${series.center[2] / 12}px`,
            fontFamily: 'Inter',
          });
        },
      },
    },
    title: {
      text: '',
      // text: 'Gastos por categoria',
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
        showInLegend: false,
        dataLabels: [
          {
            enabled: false,
          },
        ],
      },
    },
    series: [
      {
        name: 'Percentual',
        colorByPoint: true,
        innerSize: '70%',
        data: groupedTransactions.map(({ category, percentage }, index) => ({
          name: capitalize(category),
          y: +percentage.toFixed(0),
        })),
      } as any,
    ],
  };

  return (
    <Card className={'bg-background/50 backdrop-blur-[24px] border-border p-0'}>
      <CardHeader className={'p-0'} style={{ marginBottom: -40 }}>
        <CardTitle className={'text-xl font-bold text-center mt-2 mb-0'}>Gastos por categoria</CardTitle>
        <div className={'text-md text-muted-foreground text-center mt-0 font-semibold'}>
          {/* <span className={'font-medium'}>Total</span> R$ {total.toFixed(2)} */}1 até{' '}
          {new Date().toLocaleDateString('pt-BR', { month: 'long', day: 'numeric' })}
        </div>
      </CardHeader>
      <HighchartsReact highcharts={Highcharts} options={options} />
      <CardFooter className={'p-0 mb-4'} style={{ marginTop: -30 }}>
        <div className={'flex items-center flex-col gap-2 w-full px-4'}>
          {groupedTransactions.map(({ category, percentage, total }, index) => (
            <div key={category} className={'w-full'}>
              <div className={'flex items-center justify-between gap-2 w-full mb-2'}>
                <span
                  className={'text-sm font-medium rounded-full px-2 py-0 text-white'}
                  style={{ backgroundColor: colors[index] }}
                >
                  {capitalize(category)}
                </span>
                <span className={'text-sm font-semibold'}>
                  R$ {total.toFixed(2)}{' '}
                  <span className={'text-xs text-muted-foreground'}>({percentage.toFixed(0)}%)</span>
                </span>
              </div>
              <div className={'w-full h-2 bg-[#dfdfdf] rounded-full'}>
                <div
                  className={`h-full rounded-full`}
                  style={{ width: `${percentage}%`, backgroundColor: colors[index] }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </CardFooter>
    </Card>
  );
}
