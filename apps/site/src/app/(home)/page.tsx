import { Badge } from '@site/components/ui/badge';
import { buttonVariants } from '@site/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@site/components/ui/card';
import { ArrowRight, FolderGit2, Layers, MessageSquare } from 'lucide-react';
import Link from 'next/link';

const ideas = [
  {
    number: '01',
    icon: FolderGit2,
    title: 'Start with context.',
    description:
      'Projects and worktrees give every review a place. The browser foundation already lets you connect, refresh your inventory, and select a worktree.',
    status: 'Browser foundation implemented',
  },
  {
    number: '02',
    icon: Layers,
    title: 'Follow the reasoning.',
    description:
      'The planned review experience groups changes into agent-authored layers, with an explicit reading order and unassigned changes still in view.',
    status: 'Review interface planned',
  },
  {
    number: '03',
    icon: MessageSquare,
    title: 'Close the loop.',
    description:
      'The planned comment workflow lets you discuss files, code ranges, and diffs. Agents will read the feedback through MCP and make fixes in their own tools.',
    status: 'Comments and MCP planned',
  },
];
export default function HomePage() {
  return (
    <>
      <section className="hero shell">
        <div className="hero-copy">
          <Badge variant="outline">A workspace in the making</Badge>
          <h1>
            Fast code.
            <br />
            <span>A considered review.</span>
          </h1>
          <p>
            Your agents keep building. Give yourself the space to understand
            what changed, why it matters, and what comes next.
          </p>
          <div className="hero-actions">
            <Link href="/docs" className={buttonVariants({ size: 'lg' })}>
              Explore Porcelain
              <ArrowRight data-icon="inline-end" />
            </Link>
            <Link href="/download" className="text-link">
              Release availability <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <p className="hero-note">Built to sit beside your coding agents.</p>
        </div>
        <figure
          className="review-illustration"
          aria-label="Illustration of the planned review workflow"
        >
          <div className="illustration-heading">
            <span className="mini-mark">p.</span>
            <span>ROOM TO REVIEW</span>
            <span>001</span>
          </div>
          <div className="review-sheet sheet-back">
            <span>03 / REFINE</span>
          </div>
          <div className="review-sheet sheet-middle">
            <span>02 / UNDERSTAND</span>
          </div>
          <div className="review-sheet sheet-front">
            <div className="sheet-top">
              <FolderGit2 size={19} aria-hidden="true" />
              <span>your-project / a-new-idea</span>
            </div>
            <h2>
              See the work.
              <br />
              Keep the context.
            </h2>
            <div className="code-lines" aria-hidden="true">
              <span>+ a clearer starting point</span>
              <span>+ a change worth understanding</span>
              <span>+ room for your judgment</span>
            </div>
            <div className="sheet-bottom">
              <span>01 / EXPLORE</span>
              <ArrowRight size={18} aria-hidden="true" />
            </div>
          </div>
          <figcaption>
            Review workflow concept · not a product screenshot
          </figcaption>
        </figure>
      </section>
      <section className="manifesto shell">
        <p className="eyebrow">KEEP YOUR PERSPECTIVE</p>
        <h2>
          The agent writes the code.
          <br />
          You make sense of the work.
        </h2>
        <p>
          Porcelain is a review workspace for code produced in other tools. A
          place to follow changes and keep your judgment close to the code.
        </p>
      </section>
      <section className="feature-grid shell" aria-label="Product direction">
        {ideas.map(({ number, icon: Icon, title, description, status }) => (
          <Card key={number}>
            <CardHeader>
              <div className="feature-number">
                <Icon size={22} aria-hidden="true" />
                <span>{number}</span>
              </div>
              <CardTitle>
                <h3>{title}</h3>
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">{status}</Badge>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="status-section shell">
        <div>
          <p className="eyebrow">AN HONEST START</p>
          <h2>
            Built with care.
            <br />
            Still taking shape.
          </h2>
        </div>
        <div>
          <p>
            The current rebuild includes a local server and a browser workspace
            foundation. Full review screens, packaged desktop and mobile apps,
            and remote connection workflows remain ahead.
          </p>
          <Link href="/docs/status" className="text-link">
            See what exists today <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>
      <section className="closing shell">
        <p className="eyebrow">LESS RUSH. MORE UNDERSTANDING.</p>
        <h2>Make room for the review.</h2>
        <Link href="/docs" className={buttonVariants({ size: 'lg' })}>
          Read the documentation
          <ArrowRight data-icon="inline-end" />
        </Link>
      </section>
    </>
  );
}
