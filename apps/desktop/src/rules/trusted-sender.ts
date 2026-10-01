import { appDocument } from './navigation.ts';

export function trustedSender<Contents, Frame>(
  sender: { contents: Contents; frame: Frame | null; url: string | undefined },
  app: { contents: Contents; mainFrame: Frame } | undefined,
): boolean {
  return (
    app !== undefined &&
    sender.contents === app.contents &&
    sender.frame !== null &&
    sender.frame === app.mainFrame &&
    sender.url !== undefined &&
    appDocument(sender.url)
  );
}
