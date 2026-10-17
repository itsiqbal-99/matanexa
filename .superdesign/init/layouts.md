# Existing layout

Source: apps/web/app/layout.tsx. Next.js App Router, no existing navigation.

```tsx
import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Matanexa — Fondasi lokal',
  description: 'Fondasi pengembangan lokal Matanexa. Tahap G0.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
```
