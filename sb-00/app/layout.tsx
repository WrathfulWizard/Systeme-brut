import type { Metadata } from 'next';
import { Inter, Archivo_Narrow, Roboto_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const archivo = Archivo_Narrow({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-archivo' });
const robotoMono = Roboto_Mono({ subsets: ['latin'], variable: '--font-roboto-mono' });

export const metadata: Metadata = {
  title: 'Systeme Brut // SB-00',
  description: 'The master hub — un-gamified biological command center.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${archivo.variable} ${robotoMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
