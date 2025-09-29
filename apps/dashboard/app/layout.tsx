import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tiny Chatbot Dashboard',
  description: 'Tenant administration for the embedded chatbot.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
