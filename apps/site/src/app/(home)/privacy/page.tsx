import { Alert, AlertDescription, AlertTitle } from '@site/components/ui/alert';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Privacy — draft',
  description:
    'Draft privacy information for Porcelain. Hosting and operational details require confirmation before publication as a final policy.',
};
export default function PrivacyPage() {
  return (
    <article className="shell document-page privacy-page">
      <p className="eyebrow">PRIVACY</p>
      <h1>
        Privacy, with the
        <br />
        details still to confirm.
      </h1>
      <Alert>
        <AlertTitle>Draft — factual confirmation required</AlertTitle>
        <AlertDescription>
          This is not a finalized privacy policy. Hosting, operational
          practices, and the responsible entity have not yet been confirmed.
        </AlertDescription>
      </Alert>
      <section className="prose-section">
        <h2>This public website</h2>
        <p>
          This site presents Porcelain and its documentation. It does not
          connect to your Porcelain server or ask for access to your
          repositories. No account, email signup, or analytics integration has
          been added to this application.
        </p>
        <p>
          Hosting has not been selected. The handling of request logs, IP
          addresses, retention, infrastructure providers, and international
          transfers must be confirmed for the actual deployment. The absence of
          an analytics integration is not a promise that a future host collects
          no data.
        </p>
        <h2>Local preferences and search</h2>
        <p>
          The documentation theme control stores your appearance preference in
          browser local storage. Documentation search sends your search terms to
          this site's search endpoint. Search infrastructure and any server
          logging must be reviewed before a final policy is published.
        </p>
        <h2>The Porcelain application</h2>
        <p>
          Porcelain's architecture keeps each environment authoritative for its
          own repositories and private review data. This public website is
          separate from that application. Future remote connections, artifact
          sharing, and distribution need their own confirmed data-handling
          details.
        </p>
        <h2>Before this becomes a final policy</h2>
        <p>
          The responsible entity and contact address, applicable rights and
          request process, hosting providers, retention periods, and actual data
          practices must be confirmed. This draft does not make promises about
          those unresolved details.
        </p>
      </section>
    </article>
  );
}
