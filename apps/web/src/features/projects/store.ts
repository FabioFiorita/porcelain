import { Atom } from 'effect/reactivity';

export const projectFolder = Atom.make<string | undefined>(undefined);
