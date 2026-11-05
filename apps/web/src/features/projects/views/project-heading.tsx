import type { EnvironmentIcon } from '@porcelain/client/access/rules';
import { EnvironmentGlyph } from '@/features/access/index';
import { TruncatedText } from '@/shared/views/truncated-text';

export function ProjectHeading({
  projectName,
  environmentName,
  environmentIcon,
  showEnvironment,
}: {
  projectName: string;
  environmentName: string;
  environmentIcon: EnvironmentIcon;
  showEnvironment: boolean;
}) {
  return (
    <div
      className="flex min-w-0 flex-1 flex-col gap-0.5 px-2 py-2"
      aria-label={`${projectName} · ${environmentName}`}
    >
      <div className="flex min-w-0 text-xs font-semibold">
        <TruncatedText text={projectName} />
      </div>
      {showEnvironment && (
        <div
          role="img"
          aria-label={`Computer: ${environmentName}`}
          className="flex min-w-0 items-center gap-1 text-2xs text-muted-foreground"
        >
          <EnvironmentGlyph
            icon={environmentIcon}
            className="size-3 shrink-0"
          />
          <TruncatedText text={environmentName} />
        </div>
      )}
    </div>
  );
}
