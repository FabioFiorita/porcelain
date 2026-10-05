import { BrowserKeyValueStore } from '@effect/platform-browser';
import { Atom } from 'effect/reactivity';

export const storageRuntime = Atom.runtime(
  BrowserKeyValueStore.layerLocalStorage,
);
