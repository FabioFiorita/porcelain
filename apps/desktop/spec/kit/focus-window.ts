type FocusWindow = {
  isFocused(): boolean;
  focus(): void;
  once(event: 'focus', listener: () => void): unknown;
  readonly webContents: { focus(): void };
};

export async function focusWindow({
  app,
  BrowserWindow,
}: {
  app: { focus(options: { steal: boolean }): void };
  BrowserWindow: { getAllWindows(): readonly FocusWindow[] };
}): Promise<void> {
  const view = BrowserWindow.getAllWindows()[0];
  if (view === undefined) throw new Error('The app window is missing');
  const focused = view.isFocused()
    ? Promise.resolve()
    : new Promise<void>((resolve) => view.once('focus', resolve));
  app.focus({ steal: true });
  view.focus();
  await focused;
  view.webContents.focus();
}
