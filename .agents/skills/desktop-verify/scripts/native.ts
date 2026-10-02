import type { ElectronApplication } from 'playwright';
import { z } from 'zod';

const selectionSchema = z.object({
  canceled: z.boolean(),
  filePaths: z.array(z.string()),
});

export const nativeRequestSchema = z.discriminatedUnion('command', [
  z.object({ command: z.literal('hold-picker') }),
  z.object({ command: z.literal('menu'), path: z.string().optional() }),
  z.object({ command: z.literal('window'), change: z.array(z.string()) }),
  z.object({
    command: z.literal('dialog'),
    answer: selectionSchema.optional(),
  }),
]);

export type NativeRequest = z.input<typeof nativeRequestSchema>;
type Selection = z.output<typeof selectionSchema>;

type MenuEntry = {
  label: string;
  id: string;
  role: string;
  accelerator: string;
  enabled: boolean;
  visible: boolean;
  children: MenuEntry[];
};

function menuText(entries: readonly MenuEntry[], depth = 0): string {
  return entries
    .map((entry) => {
      const facts = [
        entry.id === '' ? '' : `id ${entry.id}`,
        entry.role === '' ? '' : `role ${entry.role}`,
        entry.accelerator === '' ? '' : entry.accelerator,
        entry.enabled ? '' : 'disabled',
        entry.visible ? '' : 'hidden',
      ].filter((fact) => fact !== '');
      const line = `${'  '.repeat(depth)}${entry.label === '' ? '—' : entry.label}${facts.length > 0 ? ` (${facts.join(', ')})` : ''}`;
      return [line, menuText(entry.children, depth + 1)]
        .filter((text) => text !== '')
        .join('\n');
    })
    .join('\n');
}

async function menu(electron: ElectronApplication, path: string | undefined) {
  if (path !== undefined) {
    const clicked = await electron.evaluate(
      ({ BrowserWindow, Menu }, segments) => {
        let items = Menu.getApplicationMenu()?.items ?? [];
        const named = (label: string, wanted: string) =>
          label === wanted || label.replace(/…$/u, '') === wanted;
        for (const [index, segment] of segments.entries()) {
          const item = items.find((entry) => named(entry.label, segment));
          if (item === undefined)
            return `No menu item named ${segment}; the menu holds ${items
              .map((entry) => entry.label)
              .filter((label) => label !== '')
              .join(', ')}`;
          if (index === segments.length - 1) {
            const window =
              BrowserWindow.getFocusedWindow() ??
              BrowserWindow.getAllWindows()[0];
            Reflect.apply(item.click, item, [
              undefined,
              window,
              window?.webContents,
            ]);
            return '';
          }
          items = item.submenu?.items ?? [];
        }
        return 'Name a menu item, such as File/Open Project…';
      },
      path.split('/'),
    );
    if (clicked !== '') return `${clicked}\n`;
  }
  const entries = await electron.evaluate(({ Menu }) => {
    type Entry = {
      label: string;
      id: string;
      role: string;
      accelerator: string;
      enabled: boolean;
      visible: boolean;
      children: Entry[];
    };
    type Item = NonNullable<
      ReturnType<typeof Menu.getApplicationMenu>
    >['items'][number];
    const read = (items: Item[]): Entry[] =>
      items.map((item) => ({
        label: item.type === 'separator' ? '' : item.label,
        id: item.id ?? '',
        role: item.role ?? '',
        accelerator:
          typeof item.accelerator === 'string' ? item.accelerator : '',
        enabled: item.enabled,
        visible: item.visible,
        children: read(item.submenu?.items ?? []),
      }));
    return read(Menu.getApplicationMenu()?.items ?? []);
  });
  return `${path === undefined ? '' : `clicked ${path}\n\n`}${menuText(entries)}\n`;
}

async function windowState(electron: ElectronApplication) {
  const state = await electron.evaluate(({ BrowserWindow, screen }) => ({
    workArea: screen.getPrimaryDisplay().workArea,
    windows: BrowserWindow.getAllWindows().map((view) => ({
      id: view.id,
      title: view.getTitle(),
      url: view.webContents.getURL(),
      bounds: view.getBounds(),
      normalBounds: view.getNormalBounds(),
      maximized: view.isMaximized(),
      minimized: view.isMinimized(),
      fullscreen: view.isFullScreen(),
      focused: view.isFocused(),
      visible: view.isVisible(),
    })),
  }));
  return `${JSON.stringify(state, null, 2)}\n`;
}

async function changeWindow(
  electron: ElectronApplication,
  change: readonly string[],
) {
  const [action, first, second] = change;
  if (action === undefined) return '';
  if (action === 'resize') {
    const width = Number(first);
    const height = Number(second);
    if (!Number.isInteger(width) || !Number.isInteger(height))
      return 'window resize takes a width and a height in pixels\n';
    await electron.evaluate(
      ({ BrowserWindow }, size) =>
        BrowserWindow.getAllWindows()[0]?.setSize(size.width, size.height),
      { width, height },
    );
    return '';
  }
  if (action === 'maximize') {
    await electron.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.maximize(),
    );
    return '';
  }
  if (action === 'fullscreen' && (first === 'on' || first === 'off')) {
    await electron.evaluate(
      ({ BrowserWindow }, value) =>
        new Promise<void>((settled) => {
          const view = BrowserWindow.getAllWindows()[0];
          if (view === undefined || view.isFullScreen() === value) {
            settled();
            return;
          }
          view.focus();
          if (value) view.once('enter-full-screen', () => settled());
          else view.once('leave-full-screen', () => settled());
          view.setFullScreen(value);
        }),
      first === 'on',
    );
    return '';
  }
  if (action === 'close') {
    await electron.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.close(),
    );
    return '';
  }
  if (action === 'activate') {
    const opened = electron.waitForEvent('window');
    await electron.evaluate(({ app }) => {
      app.emit('activate');
    });
    await opened;
    return '';
  }
  return 'window takes resize <width> <height>, maximize, fullscreen on|off, close or activate\n';
}

function holdPicker(electron: ElectronApplication) {
  return electron.evaluate(({ BrowserWindow, dialog }) => {
    const requests: Record<string, unknown>[] = [];
    Reflect.set(dialog, 'porcelainVerifyRequests', requests);
    dialog.showOpenDialog = async (...args: unknown[]) => {
      const options = args[1];
      const read = (name: string): unknown =>
        typeof options === 'object' && options !== null
          ? Reflect.get(options, name)
          : undefined;
      const request: Record<string, unknown> = {
        at: new Date().toISOString(),
        ownerIsAppWindow: args[0] === BrowserWindow.getAllWindows()[0],
        title: read('title'),
        buttonLabel: read('buttonLabel'),
        defaultPath: read('defaultPath'),
        properties: read('properties'),
        answer: 'waiting',
      };
      requests.push(request);
      const armed: unknown = Reflect.get(dialog, 'porcelainVerifyArmed');
      Reflect.deleteProperty(dialog, 'porcelainVerifyArmed');
      if (
        typeof armed === 'object' &&
        armed !== null &&
        'canceled' in armed &&
        typeof armed.canceled === 'boolean' &&
        'filePaths' in armed &&
        Array.isArray(armed.filePaths)
      ) {
        const selection = {
          canceled: armed.canceled,
          filePaths: armed.filePaths.map(String),
        };
        request.answer = selection;
        return selection;
      }
      return new Promise<{ canceled: boolean; filePaths: string[] }>(
        (answer) => {
          Reflect.set(
            dialog,
            'porcelainVerifyWaiting',
            (selection: { canceled: boolean; filePaths: string[] }) => {
              request.answer = selection;
              answer(selection);
            },
          );
        },
      );
    };
  });
}

async function answerPicker(
  electron: ElectronApplication,
  answer: Selection | undefined,
) {
  const outcome =
    answer === undefined
      ? ''
      : await electron.evaluate(({ dialog }, selection) => {
          const waiting: unknown = Reflect.get(
            dialog,
            'porcelainVerifyWaiting',
          );
          if (typeof waiting === 'function') {
            Reflect.deleteProperty(dialog, 'porcelainVerifyWaiting');
            Reflect.apply(waiting, dialog, [selection]);
            return 'answered the picker that was waiting';
          }
          Reflect.set(dialog, 'porcelainVerifyArmed', selection);
          return 'the next picker the app opens gets this answer';
        }, answer);
  const requests = await electron.evaluate(({ dialog }) =>
    JSON.stringify(
      Reflect.get(dialog, 'porcelainVerifyRequests') ?? [],
      null,
      2,
    ),
  );
  return `${outcome === '' ? '' : `${outcome}\n\n`}picker requests so far:\n${requests}\n`;
}

export async function nativeCommand(
  electron: ElectronApplication,
  request: NativeRequest,
): Promise<string> {
  if (request.command === 'hold-picker') {
    await holdPicker(electron);
    return '';
  }
  if (request.command === 'menu') return menu(electron, request.path);
  if (request.command === 'window') {
    const refused = await changeWindow(electron, request.change);
    return `${refused}${await windowState(electron)}`;
  }
  return answerPicker(electron, request.answer);
}
