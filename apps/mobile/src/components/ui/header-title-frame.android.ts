export const headerTitleText = { variant: 'title', weight: 'medium' } as const;

export function useHeaderTitleFrame(_trailingItems: number) {
  return { className: 'min-w-0 flex-1 justify-center', style: undefined };
}
