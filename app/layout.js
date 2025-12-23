import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Investment Tracker',
  description: 'Track broker recommendations and company reports',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <main className="container">
          {children}
        </main>
      </body>
    </html>
  );
}
