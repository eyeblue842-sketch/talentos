import { Outfit, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const display = Outfit({ subsets: ['latin'], variable: '--font-display' });
const body = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-body' });

export const metadata = {
  title: 'CareerCraft AI | AI Career Platform',
  description: 'AI-powered resume building, cover letters, ATS scoring, job tracking, and admin operations.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="font-[var(--font-body)] text-[var(--text)]">{children}</body>
    </html>
  );
}

