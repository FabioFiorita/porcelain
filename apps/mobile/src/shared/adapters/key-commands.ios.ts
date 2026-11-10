import { requireNativeModule } from 'expo';

type PorcelainKeyboard = {
  setCommands(json: string): Promise<void>;
  addListener(
    event: 'onCommand',
    listener: (event: { id: string }) => void,
  ): { remove(): void };
};

const keyboard = requireNativeModule<PorcelainKeyboard>('PorcelainKeyboard');

export const keyCommandsSupported = true;

export function setNativeKeyCommands(json: string) {
  void keyboard.setCommands(json);
}

export function onNativeKeyCommand(listener: (id: string) => void) {
  const subscription = keyboard.addListener('onCommand', (event) =>
    listener(event.id),
  );
  return () => subscription.remove();
}
