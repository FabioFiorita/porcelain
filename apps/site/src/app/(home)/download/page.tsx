import { Badge } from '@site/components/ui/badge';
import { buttonVariants } from '@site/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@site/components/ui/empty';
import { PackageOpen } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
export const metadata: Metadata = {
  title: 'Download',
  description:
    'Porcelain release availability. The rebuild is in development; no installable release is available here yet.',
};
export default function DownloadPage() {
  return (
    <div className="shell document-page">
      <p className="eyebrow">RELEASE AVAILABILITY</p>
      <h1>
        A little more time
        <br />
        in the workshop.
      </h1>
      <p className="page-intro">
        Porcelain is being rebuilt. There are no verified installable release
        assets available on this site yet.
      </p>
      <div className="download-state">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageOpen />
            </EmptyMedia>
            <EmptyTitle>No download available yet</EmptyTitle>
            <EmptyDescription>
              Desktop and mobile packaging are still planned. No release date
              has been announced here.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Badge variant="outline">In development</Badge>
            <Link
              href="/docs/getting-started"
              className={buttonVariants({ variant: 'outline' })}
            >
              Explore the development preview
            </Link>
          </EmptyContent>
        </Empty>
      </div>
      <section className="prose-section">
        <h2>Where Porcelain is heading</h2>
        <p>
          macOS desktop, browser, iPhone, and iPad are intended surfaces. A
          standalone Node server is intended for macOS and Linux. These plans
          are not a statement of release availability.
        </p>
        <p>
          The browser foundation can be explored from source using a disposable
          local playground. See the documentation for its current scope and
          limitations.
        </p>
      </section>
    </div>
  );
}
