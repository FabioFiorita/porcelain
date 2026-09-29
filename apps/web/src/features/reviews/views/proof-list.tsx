import {
  CircleCheckIcon,
  CircleMinusIcon,
  CircleXIcon,
  ExternalLinkIcon,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useProofFile } from '../queries/proof';
import {
  checkResultLabel,
  linkHost,
  orderedChecks,
  type ProofAsset,
  type ProofCheck,
  proofFileUrl,
  type ReviewProof,
} from '../rules/proof';
import type { ReviewLayer, ReviewScope } from '../rules/review';
import type { ReviewsContext } from '../rules/reviewed';

type Target = { layerId?: string | undefined; stepId?: string | undefined };

function targetLabel(
  target: Target,
  layers: readonly ReviewLayer[],
  inLayer: boolean,
) {
  const layer = layers.find((candidate) => candidate.id === target.layerId);
  if (!layer) return undefined;
  const step = layer.steps.find((candidate) => candidate.id === target.stepId);
  if (inLayer) return step?.title;
  return step ? `${layer.title} · ${step.title}` : layer.title;
}

export function ProofList({
  scope,
  context,
  proof,
  layers,
  inLayer = false,
}: {
  scope: ReviewScope;
  context: ReviewsContext;
  proof: ReviewProof;
  layers: readonly ReviewLayer[];
  inLayer?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      {proof.checks.length > 0 && (
        <section aria-label="Checks" className="flex flex-col gap-2">
          <h2 className="text-xs font-medium text-muted-foreground">Checks</h2>
          <ul className="flex flex-col gap-1.5">
            {orderedChecks(proof.checks).map((check, index) => (
              <CheckRow
                key={`${check.result}:${check.name}:${index}`}
                check={check}
                target={targetLabel(check, layers, inLayer)}
              />
            ))}
          </ul>
        </section>
      )}
      {proof.assets.length > 0 && (
        <section aria-label="Attachments" className="flex flex-col gap-2">
          <h2 className="text-xs font-medium text-muted-foreground">
            Attachments
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {proof.assets.map((asset) => (
              <li key={asset.id} className="min-w-0">
                <AssetView
                  scope={scope}
                  context={context}
                  asset={asset}
                  target={targetLabel(asset, layers, inLayer)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function CheckRow({
  check,
  target,
}: {
  check: ProofCheck;
  target: string | undefined;
}) {
  const failed = check.result === 'fail';
  const Icon =
    check.result === 'pass'
      ? CircleCheckIcon
      : failed
        ? CircleXIcon
        : CircleMinusIcon;
  return (
    <li
      aria-label={`${check.name}: ${checkResultLabel(check.result)}`}
      data-result={check.result}
      className={cn(
        'rounded-lg border px-3 py-2',
        failed && 'border-destructive/50 bg-destructive/5',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icon
          aria-hidden
          className={cn(
            'size-4 shrink-0',
            check.result === 'pass' && 'text-graph-2',
            failed && 'text-destructive',
            check.result === 'skipped' && 'text-muted-foreground',
          )}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {check.name}
        </span>
        <span
          className={cn(
            'shrink-0 text-xs',
            failed ? 'font-medium text-destructive' : 'text-muted-foreground',
          )}
        >
          {checkResultLabel(check.result)}
        </span>
      </div>
      {target && (
        <p className="mt-0.5 truncate pl-6 text-xs text-muted-foreground">
          {target}
        </p>
      )}
      {check.output && (
        <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-2 font-mono text-xs whitespace-pre-wrap">
          {check.output}
        </pre>
      )}
    </li>
  );
}

function AssetView({
  scope,
  context,
  asset,
  target,
}: {
  scope: ReviewScope;
  context: ReviewsContext;
  asset: ProofAsset;
  target: string | undefined;
}) {
  const caption = (
    <figcaption className="flex min-w-0 flex-col px-1 pt-1.5">
      <span className="truncate text-sm">{asset.title}</span>
      {target && (
        <span className="truncate text-xs text-muted-foreground">{target}</span>
      )}
    </figcaption>
  );
  if (asset.kind === 'link')
    return (
      <figure className="rounded-lg border p-2">
        <a
          href={asset.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 items-center gap-1.5 px-1 text-sm underline-offset-2 hover:underline"
        >
          <ExternalLinkIcon aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{asset.title}</span>
        </a>
        <figcaption className="flex min-w-0 flex-col px-1 pt-0.5">
          <span className="truncate text-xs text-muted-foreground">
            {linkHost(asset.url)}
          </span>
          {target && (
            <span className="truncate text-xs text-muted-foreground">
              {target}
            </span>
          )}
        </figcaption>
      </figure>
    );
  return (
    <figure className="rounded-lg border p-2">
      <ProofMedia
        scope={scope}
        context={context}
        id={asset.id}
        title={asset.title}
        video={asset.kind === 'video'}
      />
      {caption}
    </figure>
  );
}

function ProofMedia({
  scope,
  context,
  id,
  title,
  video,
}: {
  scope: ReviewScope;
  context: ReviewsContext;
  id: string;
  title: string;
  video: boolean;
}) {
  const file = useProofFile(scope, context, id);
  if (file.isPending)
    return (
      <p role="status" className="p-3 text-xs text-muted-foreground">
        Loading {video ? 'video' : 'image'}…
      </p>
    );
  if (file.isError)
    return (
      <p role="status" className="p-3 text-xs text-muted-foreground">
        This attachment could not be loaded.
      </p>
    );
  return video ? (
    <video
      controls
      aria-label={title}
      src={proofFileUrl(file.data)}
      className="max-h-80 w-full rounded-md bg-muted"
    />
  ) : (
    <img
      src={proofFileUrl(file.data)}
      alt={title}
      className="max-h-80 w-full rounded-md bg-muted object-contain"
    />
  );
}
