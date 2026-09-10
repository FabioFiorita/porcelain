import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Brand } from '../components/brand';
export function baseOptions(): BaseLayoutProps {
  return {
    nav: { title: <Brand />, url: '/' },
    links: [
      { text: 'Download', url: '/download' },
      { text: 'Privacy', url: '/privacy' },
    ],
  };
}
