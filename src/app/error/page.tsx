import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Financiia - Error',
};

export default function ErrorPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
      <p className="mt-10 text-center text-xl font-bold leading-9 tracking-tight text-primary">
        Ocorreu um erro, por favor tente novamente mais tarde
      </p>
    </div>
  );
}
