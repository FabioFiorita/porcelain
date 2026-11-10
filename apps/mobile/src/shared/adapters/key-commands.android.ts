import type { NativeKeyCommand } from '../rules/key-commands';

export const keyCommandsSupported = false;

export function setNativeKeyCommands(_commands: readonly NativeKeyCommand[]) {}

export function onNativeKeyCommand(_listener: (id: string) => void) {
  return () => {};
}
