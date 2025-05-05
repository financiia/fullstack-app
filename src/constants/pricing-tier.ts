export interface Tier {
  name: string;
  id: 'basic' | 'pro' | 'advanced';
  icon: string;
  description: string;
  features: string[];
  featured: boolean;
  priceId: string;
  price: number;
}

export const PricingTier: Tier[] = [
  {
    name: 'Básico',
    id: 'basic',
    icon: '/assets/icons/price-tiers/free-icon.svg',
    description: 'Ideal para solteiros querendo organizar suas despesas',
    features: [
      'Conversa direta com a Marill.IA',
      '30 dias de avaliação grátis',
      'Dashboard para gerenciar suas despesas',
    ],
    featured: false,
    priceId: '2418377281-b8898942-4af0-4754-9132-f2befa9150db',
    price: 12.9,
  },
  // {
  //   name: 'Pro',
  //   id: 'pro',
  //   icon: '/assets/icons/price-tiers/basic-icon.svg',
  //   description: 'Enhanced design tools for scaling teams who need more flexibility.',
  //   features: ['Integrations', 'Unlimited workspaces', 'Advanced editing tools', 'Everything in Starter'],
  //   featured: true,
  //   priceId: '2418377281-b8898942-4af0-4754-9132-f2befa9150db',
  //   price: 12.90,
  // },
  // {
  //   name: 'Advanced',
  //   id: 'advanced',
  //   icon: '/assets/icons/price-tiers/pro-icon.svg',
  //   description: 'Powerful tools designed for extensive collaboration and customization.',
  //   features: [
  //     'Single sign on (SSO)',
  //     'Advanced version control',
  //     'Assets library',
  //     'Guest accounts',
  //     'Everything in Pro',
  //   ],
  //   featured: false,
  //   priceId: '2418377281-b8898942-4af0-4754-9132-f2befa9150db',
  //   price: 12.90,
  // },
];
