import { shortOid } from '@porcelain/client/history/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import type { CommitParentMenuProps } from './commit-parent-menu-props';

export function CommitParentMenu({
  parentOids,
  parent,
  onSelect,
}: CommitParentMenuProps) {
  return (
    <Box gap={2}>
      {parentOids.map((oid, index) => (
        <Button
          key={oid}
          label={`Parent ${index + 1} · ${shortOid(oid)}`}
          variant={parent === index + 1 ? 'default' : 'outline'}
          onPress={() => onSelect(index + 1)}
        />
      ))}
    </Box>
  );
}
