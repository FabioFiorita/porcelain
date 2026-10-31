import {
  environmentIconLabels,
  environmentIcons,
  type EnvironmentIcon,
} from '@porcelain/client/access/rules';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EnvironmentGlyph } from './environment-glyph';

export function EnvironmentIconPicker({
  icon,
  pending,
  onChange,
}: {
  icon: EnvironmentIcon;
  pending: boolean;
  onChange: (icon: EnvironmentIcon) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            aria-label={`Icon: ${environmentIconLabels[icon]}`}
          />
        }
      >
        <EnvironmentGlyph icon={icon} />
        Icon
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Icon of this computer</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={icon}
            onValueChange={(value: EnvironmentIcon) => onChange(value)}
          >
            {environmentIcons.map((choice) => (
              <DropdownMenuRadioItem
                key={choice}
                value={choice}
                className="cursor-pointer"
              >
                <EnvironmentGlyph icon={choice} />
                {environmentIconLabels[choice]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
