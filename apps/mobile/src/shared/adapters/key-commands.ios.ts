import { requireNativeModule } from 'expo';
import type { NativeKeyCommand } from '../rules/key-commands';

type PorcelainKeyboard = {
  setCommands(json: string): Promise<void>;
  addListener(
    event: 'onCommand',
    listener: (event: { id: string }) => void,
  ): { remove(): void };
};

const keyboard = requireNativeModule<PorcelainKeyboard>('PorcelainKeyboard');

export const keyCommandsSupported = true;

let sent: string | undefined;

export function setNativeKeyCommands(commands: readonly NativeKeyCommand[]) {
  const json = JSON.stringify(commands);
  if (json === sent) return;
  sent = json;
  void keyboard.setCommands(json);
}

export function onNativeKeyCommand(listener: (id: string) => void) {
  const subscription = keyboard.addListener('onCommand', (event) =>
    listener(event.id),
  );
  return () => subscription.remove();
}
