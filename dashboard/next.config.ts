import type { NextConfig } from 'next';

// Rein statische Seite (Ordner out/): läuft auf jedem Gratis-Hosting (Vercel, Netlify, ...).
// Alle Daten kommen direkt aus Supabase, abgesichert durch Row Level Security.
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
};

export default nextConfig;
