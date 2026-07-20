import { Inter } from 'next/font/google';
import { AppProviders } from '@/components/providers/app-providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata = {
  title: 'Careeriz | AI-Powered Talent Intelligence Platform',
  description: 'Careeriz is an AI-powered talent intelligence platform for hiring teams and candidates.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-[var(--font-body)] text-[var(--text)]">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

