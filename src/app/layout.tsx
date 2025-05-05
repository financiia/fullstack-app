import { Inter } from 'next/font/google';
import '../styles/globals.css';
import '../styles/layout.css';
import { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://financiia.com'),
  title: 'Financiia',
  description:
    'Financiia é uma plataforma de gerenciamento financeiro que ajuda você a controlar suas finanças de forma fácil e eficiente.',
  icons: {
    icon: [
      {
        media: '(prefers-color-scheme: light)',
        url: '/logo-fundo-claro.png',
        href: '/logo-fundo-claro.png',
      },
      {
        media: '(prefers-color-scheme: dark)',
        url: '/logo-fundo-escuro.png',
        href: '/logo-fundo-escuro.png',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={'min-h-full bg-[#afafaf]'}>
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
