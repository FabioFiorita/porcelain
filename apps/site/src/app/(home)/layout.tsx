import { Brand } from '@site/components/brand';
import { buttonVariants } from '@site/components/ui/button';
import Link from 'next/link';
export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="site-header shell">
        <Link href="/" aria-label="Porcelain home">
          <Brand />
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/docs">Documentation</Link>
          <Link
            href="/download"
            className={buttonVariants({ variant: 'outline' })}
          >
            Download
          </Link>
        </nav>
      </header>
      <main id="main">{children}</main>
      <footer className="site-footer shell">
        <div>
          <Brand />
          <p>A little distance. A clearer view.</p>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/docs">Documentation</Link>
          <Link href="/download">Download</Link>
          <Link href="/privacy">Privacy draft</Link>
        </nav>
        <span className="footer-note">Porcelain · In development</span>
      </footer>
    </>
  );
}
