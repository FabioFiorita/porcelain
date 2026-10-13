import { Schema } from 'effect';

export const desktopActionSchema = Schema.Literals([
  'open-project',
  'open-settings',
]);
export const desktopAppearanceSchema = Schema.Literals([
  'system',
  'light',
  'dark',
]);
export const desktopAppUpdateStateSchema = Schema.Union([
  Schema.Struct({ status: Schema.Literal('idle') }),
  Schema.Struct({ status: Schema.Literal('checking') }),
  Schema.Struct({ status: Schema.Literal('unavailable') }),
  Schema.Struct({
    status: Schema.Literal('available'),
    version: Schema.String,
  }),
  Schema.Struct({
    status: Schema.Literal('downloading'),
    version: Schema.String,
  }),
  Schema.Struct({ status: Schema.Literal('ready'), version: Schema.String }),
  Schema.Struct({
    status: Schema.Literal('installing'),
    version: Schema.String,
  }),
  Schema.Struct({ status: Schema.Literal('error'), message: Schema.String }),
]);
export const desktopCredentialsSchema = Schema.Union([
  Schema.Struct({ status: Schema.Literal('empty') }),
  Schema.Struct({ status: Schema.Literal('saved'), value: Schema.String }),
  Schema.Struct({
    status: Schema.Literal('unreadable'),
    message: Schema.String,
  }),
]);
export const desktopWindowStateSchema = Schema.Struct({
  bounds: Schema.Struct({
    x: Schema.Number.check(Schema.isInt()),
    y: Schema.Number.check(Schema.isInt()),
    width: Schema.Number.check(Schema.isInt()).check(Schema.isGreaterThan(0)),
    height: Schema.Number.check(Schema.isInt()).check(Schema.isGreaterThan(0)),
  }),
  maximized: Schema.Boolean,
});
export const desktopMcpConfigurationSchema = Schema.Struct({
  command: Schema.String,
  dataDirectory: Schema.String,
});
export type DesktopMcpConfiguration = typeof desktopMcpConfigurationSchema.Type;
export type DesktopAction = typeof desktopActionSchema.Type;
export type DesktopAppearance = typeof desktopAppearanceSchema.Type;
export type DesktopWindowState = typeof desktopWindowStateSchema.Type;
export type DesktopCredentials = typeof desktopCredentialsSchema.Type;
export type DesktopAppUpdateState = typeof desktopAppUpdateStateSchema.Type;
export type DesktopBridge = {
  mcpConfiguration: () => Promise<DesktopMcpConfiguration>;
  pickProjectFolder: () => Promise<string | null>;
  credentials: {
    read: () => Promise<DesktopCredentials>;
    write: (value: string) => Promise<void>;
    clear: () => Promise<void>;
  };
  appUpdate: {
    current: () => string;
    enabled: () => boolean;
    check: () => Promise<void>;
    install: () => Promise<void>;
    onState: (receive: (state: DesktopAppUpdateState) => void) => () => void;
  };
  liveAddress: () => string;
  isFullscreen: () => boolean;
  onFullscreen: (receive: (fullscreen: boolean) => void) => () => void;
  onAction: (receive: (action: DesktopAction) => void) => () => void;
  setAppearance: (appearance: DesktopAppearance) => void;
};
