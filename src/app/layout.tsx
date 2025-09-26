import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ProMapcy',
  description: 'Interactive mind maps for public repositories',
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
