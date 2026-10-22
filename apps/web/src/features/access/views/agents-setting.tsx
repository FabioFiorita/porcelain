import { useState } from 'react';
import { CopyIcon } from 'lucide-react';
import { FieldLegend, FieldSet } from '@/components/ui/field';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
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
import { agentMcpCommand } from '../rules/settings';

export function AgentsSetting() {
  const [agent, setAgent] = useState<'claude' | 'codex'>('claude');
  const { configuration, failed, retry } = useMcpConfiguration();
  const base = desktopShell
    ? configuration?.command
    : 'claude mcp add porcelain -- porcelain mcp';
  const command = base === undefined ? undefined : agentMcpCommand(base, agent);
  return (
    <FieldSet>
      <FieldLegend variant="label">Agents</FieldLegend>
      <ItemGroup>
        <Item variant="outline">
          <ItemContent className="min-w-0">
            <ItemTitle>Porcelain MCP server</ItemTitle>
            <Tabs
              value={agent}
              onValueChange={(value: unknown) => {
                if (value === 'claude' || value === 'codex') setAgent(value);
              }}
            >
              <TabsList aria-label="Agent">
                <TabsTrigger value="claude">Claude Code</TabsTrigger>
                <TabsTrigger value="codex">Codex</TabsTrigger>
              </TabsList>
            </Tabs>
            <p
              className="break-all rounded-md bg-muted p-3 font-mono text-xs"
              role="status"
            >
              {command ??
                (failed
                  ? 'MCP configuration is unavailable.'
                  : 'Loading MCP configuration…')}
            </p>
            <ItemDescription>
              {desktopShell
                ? 'Run it once on this computer.'
                : 'Run it once on the computer hosting your Porcelain server.'}{' '}
              Agents publish reviews, answer comments and read your reviewed
              marks through the Porcelain MCP server. It needs no credential.
            </ItemDescription>
            {desktopShell && (
              <p className="text-xs text-muted-foreground">
                This command connects to this app's local server while the app
                is running, including when you are viewing another computer.
              </p>
            )}
            {desktopShell && configuration && (
              <p className="text-xs text-muted-foreground">
                Local server data:{' '}
                <code className="break-all font-mono">
                  {configuration.dataDirectory}
                </code>
                .
              </p>
            )}
          </ItemContent>
          <ItemActions>
            {desktopShell && failed && (
              <Button size="sm" variant="outline" onClick={retry}>
                Retry MCP configuration
              </Button>
            )}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant="ghost"
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
              <TooltipContent>Copy MCP configuration</TooltipContent>
            </Tooltip>
          </ItemActions>
        </Item>
      </ItemGroup>
    </FieldSet>
  );
}
