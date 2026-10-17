import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content',
};

export const metadata: Metadata = {
  title: 'Matanexa — Cari hadits dengan bahasa sehari-hari',
  description:
    'Jelajahi referensi hadits dengan bahasa Indonesia sehari-hari. Pratinjau lokal dengan sumber dan status data yang transparan.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
