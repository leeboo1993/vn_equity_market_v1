import './globals.css';
import { Inter } from 'next/font/google';
import { SessionProvider } from "next-auth/react";

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Vietnamese Equity Market',
  description: 'Track broker recommendations and company reports',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <SessionProvider>
          <div className="main-container">
            {children}
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
