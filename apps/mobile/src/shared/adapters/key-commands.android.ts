export const keyCommandsSupported = false;

export function setNativeKeyCommands(_json: string) {}

export function onNativeKeyCommand(_listener: (id: string) => void) {
  return () => {};
}
