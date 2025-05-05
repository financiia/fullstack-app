import Link from 'next/link';
import { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';

interface Props {
  user: User | null;
}

export default function Header({ user }: Props) {
  return (
    <nav id="header" className="bg-background/70 backdrop-blur-[6px] sticky top-0 z-50 border-b border-border">
      <div className="mx-auto max-w-7xl relative px-[32px] py-[18px] flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <Link className="flex items-center" href={'/'}>
            {/* <Image className="w-auto block" src="/logo.png" width={131} height={28} alt="AeroEdit" /> */}
          </Link>
          <div className="hidden md:flex items-center space-x-6">
            <Link
              href="#features"
              className="text-foreground/80 hover:text-foreground transition-colors"
              onClick={(e) => {
                e.preventDefault();
                const headerOffset = document.getElementById('header')?.offsetHeight ?? 0; // Altura aproximada do header + margem
                const element = document.querySelector('#features');
                const elementPosition = element?.getBoundingClientRect().top ?? 0;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                window.scrollTo({
                  top: offsetPosition,
                  behavior: 'smooth',
                });
              }}
            >
              Funcionalidades
            </Link>
            <Link
              href="#pricing"
              className="text-foreground/80 hover:text-foreground transition-colors"
              onClick={(e) => {
                e.preventDefault();
                document.querySelector('#pricing')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Preços
            </Link>
            <Link href="#faq" className="text-foreground/80 hover:text-foreground transition-colors">
              FAQ
            </Link>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          {user?.id ? (
            <Button variant={'default'} asChild={true}>
              <Link href={'/dashboard'}>Dashboard</Link>
            </Button>
          ) : (
            <Button asChild={true} variant={'ghost'}>
              <Link href={'/signup'}>Entrar</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
