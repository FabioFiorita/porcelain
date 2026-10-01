import { z } from 'zod';

export const desktopActionSchema = z.enum(['open-project', 'open-settings']);
export const desktopAppearanceSchema = z.enum(['system', 'light', 'dark']);
export const desktopAppUpdateCheckSchema = z.object({
  available: z.string().nullable(),
});
export const desktopAppUpdateStateSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('idle') }),
  z.object({ status: z.literal('checking') }),
  z.object({ status: z.literal('available'), version: z.string() }),
  z.object({ status: z.literal('downloading'), version: z.string() }),
  z.object({ status: z.literal('verifying'), version: z.string() }),
  z.object({ status: z.literal('ready'), version: z.string() }),
  z.object({ status: z.literal('installing'), version: z.string() }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
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
export type DesktopAppUpdateCheck = z.output<
  typeof desktopAppUpdateCheckSchema
>;
export type DesktopAppUpdateState = z.output<
  typeof desktopAppUpdateStateSchema
>;
export type DesktopBridge = {
  pickProjectFolder: () => Promise<string | null>;
  credentials: {
    read: () => Promise<string | null>;
    write: (value: string) => Promise<void>;
    clear: () => Promise<void>;
  };
  appUpdate: {
    current: () => string;
    check: () => Promise<DesktopAppUpdateCheck>;
    install: () => Promise<void>;
    onState: (receive: (state: DesktopAppUpdateState) => void) => () => void;
  };
  liveAddress: () => string;
  isFullscreen: () => boolean;
  onFullscreen: (receive: (fullscreen: boolean) => void) => () => void;
  onAction: (receive: (action: DesktopAction) => void) => () => void;
  setAppearance: (appearance: DesktopAppearance) => void;
};
