import { useState } from 'react';
import type { EnvironmentIcon } from '@porcelain/client/access/rules';
import { Badge } from '@/components/ui/badge';
import { SidebarGroupLabel } from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  const names = `${projectName}\n${environmentName}`;
  const [cramped, setCramped] = useState<string>();
  const iconOnly = cramped === names;
  const environmentLabel = `Computer: ${environmentName}`;
  const measure = (heading: HTMLDivElement | null) => {
    if (!heading || !showEnvironment || iconOnly) return;
    const texts = [
      ...heading.querySelectorAll<HTMLElement>('[data-truncated]'),
    ];
    let active = true;
    const check = () => {
      if (active && texts.some((text) => text.scrollWidth > text.clientWidth))
        setCramped(names);
    };
    check();
    const observer = new ResizeObserver(check);
    for (const text of texts) observer.observe(text);
    document.fonts.addEventListener('loadingdone', check);
    return () => {
      active = false;
      observer.disconnect();
      document.fonts.removeEventListener('loadingdone', check);
    };
  };
  return (
    <div ref={measure} className="flex min-w-0 flex-1 items-center gap-1">
      <SidebarGroupLabel
        aria-label={`${projectName} · ${environmentName}`}
        className="min-w-0 flex-1"
      >
        <TruncatedText text={projectName} />
      </SidebarGroupLabel>
      {showEnvironment &&
        (iconOnly ? (
          <Tooltip disableHoverablePopup>
            <TooltipTrigger
              render={
                <Badge
                  variant="secondary"
                  role="img"
                  tabIndex={0}
                  aria-label={environmentLabel}
                />
              }
            >
              <EnvironmentGlyph icon={environmentIcon} />
            </TooltipTrigger>
            <TooltipContent>{environmentName}</TooltipContent>
          </Tooltip>
        ) : (
          <Badge
            variant="secondary"
            className="max-w-20"
            role="img"
            aria-label={environmentLabel}
          >
            <EnvironmentGlyph icon={environmentIcon} />
            <TruncatedText text={environmentName} />
          </Badge>
        ))}
    </div>
  );
}
