import { notFound } from 'next/navigation';
import { DesignSystemShowcase } from '@/components/dev/design-system-showcase';

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return <DesignSystemShowcase />;
}
