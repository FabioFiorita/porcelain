import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  connectionRoutes,
  connectionRouteTitle,
  type Remote,
} from '@porcelain/client/access/rules';
import { CopyIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@/components/ui/item';
import {
  SettingsGroup,
  SettingsSection,
} from '@/shared/views/settings-section';
import { copyText } from '@/shared/workspace/copy';

export function SavedWaysIn({ remote }: { remote: Remote }) {
  const routes = connectionRoutes(remote);
  return (
    <SettingsSection id="saved-connections" title="Saved connections">
      <SettingsGroup>
        {routes.map(({ address }) => (
          <Item key={address}>
            <ItemContent>
              <ItemTitle>{connectionRouteTitle(address)}</ItemTitle>
              <ItemDescription className="break-all">
                <span className="font-mono">{address}</span>
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Copy ${address}`}
                      onClick={() => copyText(address, 'address')}
                    >
                      <CopyIcon />
                    </Button>
                  }
                />
                <TooltipContent
                  role="tooltip"
                  className="break-all"
                >{`Copy ${address}`}</TooltipContent>
              </Tooltip>
            </ItemActions>
          </Item>
        ))}
      </SettingsGroup>
    </SettingsSection>
  );
}
