import {
  CloudIcon,
  LaptopIcon,
  MonitorIcon,
  ServerIcon,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';
import type { EnvironmentIcon } from '@porcelain/client/access/rules';

const glyphs: Record<EnvironmentIcon, LucideIcon> = {
  desktop: MonitorIcon,
  laptop: LaptopIcon,
  server: ServerIcon,
  cloud: CloudIcon,
};

export function EnvironmentGlyph({
  icon,
  ...props
}: LucideProps & { icon: EnvironmentIcon }) {
  const Glyph = glyphs[icon];
  return <Glyph {...props} />;
}
