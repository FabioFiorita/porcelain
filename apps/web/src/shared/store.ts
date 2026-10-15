import { Atom } from 'effect/reactivity';

export const atomRegistry = Atom.make((get) => get.registry);

export const mediaQuery = Atom.family((query: string) =>
  Atom.make((get) => {
    const media = window.matchMedia(query);
    const update = () => get.setSelf(media.matches);
    media.addEventListener('change', update);
    get.addFinalizer(() => media.removeEventListener('change', update));
    return media.matches;
  }),
);

const documentTitleOwner = Atom.make(() => {
  const previous = document.title;
  const titles = new Map<symbol, string>();
  return (title: string) => {
    const owner = Symbol();
    titles.set(owner, title);
    document.title = title;
    return () => {
      titles.delete(owner);
      document.title = [...titles.values()].at(-1) ?? previous;
    };
  };
});

export const documentTitle = Atom.family((title: string) =>
  Atom.make((get) => {
    get.addFinalizer(get(documentTitleOwner)(title));
  }),
);
