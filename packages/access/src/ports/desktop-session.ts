import { Context } from 'effect';
import type { DesktopSession as DesktopSessionShape } from '../models/desktop-session.ts';
export const DesktopSession = Context.Service<
  '@porcelain/access/DesktopSession',
  DesktopSessionShape | undefined
>('@porcelain/access/DesktopSession');
