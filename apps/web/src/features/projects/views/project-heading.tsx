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
import { useElement } from '@/shared/hooks/use-element';
import { TruncatedText } from '@/shared/views/truncated-text';

function clipped(element: HTMLElement) {
  return element.scrollWidth > element.clientWidth;
}

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
  const projectText = useElement<HTMLSpanElement>();
  const iconOnly = cramped === names;
  const environmentLabel = `Computer: ${environmentName}`;
  const measure = (environmentText: HTMLSpanElement | null) => {
    const project = projectText.element;
    if (!environmentText || !project) return;
    let active = true;
    const check = () => {
      if (active && (clipped(project) || clipped(environmentText)))
        setCramped(names);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(project);
    observer.observe(environmentText);
    document.fonts.addEventListener('loadingdone', check);
    return () => {
      active = false;
      observer.disconnect();
      document.fonts.removeEventListener('loadingdone', check);
    };
  };
  return (
    <>
      <SidebarGroupLabel
        aria-label={`${projectName} · ${environmentName}`}
        className="min-w-0 flex-1"
      >
        <TruncatedText
          text={projectName}
          render={<span ref={projectText.attach} />}
        />
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
            <TruncatedText
              text={environmentName}
              render={<span ref={measure} />}
            />
          </Badge>
        ))}
    </>
  );
}
