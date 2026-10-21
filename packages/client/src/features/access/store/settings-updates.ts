import { Atom } from 'effect/reactivity';
import type { SettingsUpdateBatch } from '../rules/settings-updates.ts';

export const settingsUpdateBatch = Atom.make<SettingsUpdateBatch>({
  running: false,
  entries: [],
}).pipe(Atom.keepAlive);
