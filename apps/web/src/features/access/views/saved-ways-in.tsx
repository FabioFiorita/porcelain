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
import { FieldLegend, FieldSet } from '@/components/ui/field';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@/components/ui/item';
import { copyText } from '@/shared/workspace/copy';

export function SavedWaysIn({ remote }: { remote: Remote }) {
  const routes = connectionRoutes(remote);
  return (
    <FieldSet>
      <FieldLegend variant="label">Ways in</FieldLegend>
      <ItemGroup>
        {routes.map(({ address }) => (
          <Item key={address}>
            <ItemContent>
              <ItemTitle>{connectionRouteTitle(address)}</ItemTitle>
              <ItemDescription className="break-all">{address}</ItemDescription>
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
                <TooltipContent className="break-all">{`Copy ${address}`}</TooltipContent>
              </Tooltip>
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
      <p className="text-xs text-muted-foreground">
        Saved connections. Manage ways in on that computer.
      </p>
    </FieldSet>
  );
}
