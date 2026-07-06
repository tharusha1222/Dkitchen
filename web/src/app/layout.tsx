import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Playfair_Display } from 'next/font/google';
import './globals.css';
import { CartProvider } from '@/components/CartProvider';

const jakarta = Plus_Jakarta_Sans({ 
  subsets: ['latin'],
  variable: '--font-sans',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
});

export const metadata: Metadata = {
  title: 'DKitchen — Authentic Sri Lankan Rice & Curry',
  description: 'Homestyle meals made fresh daily. Order via our WhatsApp Channel.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jakarta.variable} ${playfair.variable} dark`}>
      <body className={`font-sans antialiased bg-[#061208] text-[#fdf0dc]`}>
        <CartProvider>
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
