import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata } from 'next';
import './global.css';

const siteUrl = URL.parse(
  process.env.PORCELAIN_SITE_URL ?? 'http://localhost:3000',
);
if (!siteUrl || !['http:', 'https:'].includes(siteUrl.protocol)) {
  throw new Error('PORCELAIN_SITE_URL must be an absolute HTTP(S) URL.');
}

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: 'Porcelain — A considered look at agent-written code',
    template: '%s | Porcelain',
  },
  description:
    'A review workspace beside your coding agents. Understand the work, keep your context, and decide what comes next. Currently in development.',
};
export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
