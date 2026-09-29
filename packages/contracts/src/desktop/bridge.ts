import { z } from 'zod';

export const desktopActionSchema = z.enum(['open-project', 'open-settings']);
export const desktopAppearanceSchema = z.enum(['system', 'light', 'dark']);
export const desktopWindowStateSchema = z.object({
  bounds: z.object({
    x: z.number().int(),
    y: z.number().int(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  maximized: z.boolean(),
});
export type DesktopAction = z.output<typeof desktopActionSchema>;
export type DesktopAppearance = z.output<typeof desktopAppearanceSchema>;
export type DesktopWindowState = z.output<typeof desktopWindowStateSchema>;
export type DesktopBridge = {
  liveAddress: () => string;
  isFullscreen: () => boolean;
  onFullscreen: (receive: (fullscreen: boolean) => void) => () => void;
  onAction: (receive: (action: DesktopAction) => void) => () => void;
  setAppearance: (appearance: DesktopAppearance) => void;
};
