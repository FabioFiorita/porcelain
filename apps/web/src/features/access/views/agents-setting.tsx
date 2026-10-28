import { useState } from 'react';
import { CopyIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { desktopShell } from '@/shared/shell';
import { copyText } from '@/shared/workspace/copy';
import { useMcpConfiguration } from '../queries/mcp-configuration';
import {
  agentMcpCommand,
  commandParts,
  type CommandPart,
} from '../rules/settings';

export function AgentsSetting() {
  const [agent, setAgent] = useState<'claude' | 'codex'>('claude');
  const { configuration, failed, retry } = useMcpConfiguration();
  const base = desktopShell
    ? configuration?.command
    : 'claude mcp add porcelain -- porcelain mcp';
  const command = base === undefined ? undefined : agentMcpCommand(base, agent);
  return (
    <section
      aria-labelledby="agents-heading"
      className="flex min-w-0 flex-col gap-2"
    >
      <div className="mb-px flex min-h-6 items-center justify-between gap-2">
        <h2
          id="agents-heading"
          className="text-xs leading-4 font-medium text-muted-foreground"
        >
          Agents
        </h2>
        <Tabs
          value={agent}
          onValueChange={(value: unknown) => {
            if (value === 'claude' || value === 'codex') setAgent(value);
          }}
        >
          <TabsList aria-label="Agent" data-size="sm">
            <TabsTrigger value="claude">Claude Code</TabsTrigger>
            <TabsTrigger value="codex">Codex</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="relative rounded-lg bg-muted py-2.25 pr-11 pl-3 inset-ring inset-ring-border">
        <code
          className="block font-mono text-xs leading-4.75 wrap-anywhere"
          role="status"
        >
          <CommandText command={command} failed={failed} />
        </code>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                className="absolute top-1.5 right-1.5"
                aria-label="Copy MCP configuration"
                disabled={command === undefined}
                onClick={() => {
                  if (command !== undefined)
                    copyText(command, 'MCP configuration');
                }}
              />
            }
          >
            <CopyIcon />
          </TooltipTrigger>
          <TooltipContent role="tooltip">Copy MCP configuration</TooltipContent>
        </Tooltip>
      </div>
      <p className="text-xs leading-4.5 text-muted-foreground">
        {desktopShell
          ? 'Run it once on this computer.'
          : 'Run it once on the computer hosting your Porcelain server.'}{' '}
        Agents publish reviews, answer comments and read your reviewed marks
        through the Porcelain MCP server. It needs no credential.
        {desktopShell &&
          " This command connects to this app's local server while the app is running, including when you are viewing another computer."}
      </p>
      {desktopShell && configuration && (
        <p className="text-xs leading-4.5 text-muted-foreground">
          Local server data:{' '}
          <code className="font-mono break-all">
            {configuration.dataDirectory}
          </code>
          .
        </p>
      )}
      {desktopShell && failed && (
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          onClick={retry}
        >
          Retry MCP configuration
        </Button>
      )}
    </section>
  );
}

function CommandText({
  command,
  failed,
}: {
  command: string | undefined;
  failed: boolean;
}) {
  if (command !== undefined)
    return commandParts(command).map((part, index) => (
      <span key={index} className={partColors[part.kind]}>
        {part.text}
      </span>
    ));
  return failed
    ? 'MCP configuration is unavailable.'
    : 'Loading MCP configuration…';
}

const partColors: Record<CommandPart['kind'], string | undefined> = {
  program: 'text-(--syn-fn)',
  quoted: 'text-(--syn-str)',
  plain: undefined,
};
