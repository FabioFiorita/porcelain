export type SidebarMotion = {
  readonly stop: () => void;
  readonly settle: (width: number) => void;
  readonly animate: (width: number) => void;
};

export function transitionSidebar(
  motion: SidebarMotion,
  visible: boolean,
  width: number,
  reduceMotion: boolean,
) {
  motion.stop();
  const target = visible ? width : 0;
  if (reduceMotion) motion.settle(target);
  else motion.animate(target);
}
