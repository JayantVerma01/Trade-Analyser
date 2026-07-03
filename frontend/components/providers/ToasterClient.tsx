'use client';

import dynamic from 'next/dynamic';

// Client-only wrapper so the root server layout never tries to SSR Radix's
// toast viewport — eliminates the <ol> hydration mismatch entirely.
const Toaster = dynamic(
  () => import('@/components/ui/toaster').then((mod) => mod.Toaster),
  { ssr: false },
);

export default function ToasterClient() {
  return <Toaster />;
}
