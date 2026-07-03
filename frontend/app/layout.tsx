import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ToasterClient from '@/components/providers/ToasterClient';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Trade Analyser AI',
  description: 'AI-powered trade analysis assistant for the Indian Stock Market',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        {children}
        <ToasterClient />
      </body>
    </html>
  );
}
