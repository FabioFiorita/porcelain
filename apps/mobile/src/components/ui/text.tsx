import {
  Text as NativeText,
  type TextProps as NativeTextProps,
} from 'react-native';

const variants = {
  largeTitle: 'text-[28px] leading-[34px]',
  title: 'text-xl leading-7',
  headline: 'text-base leading-5.5',
  body: 'text-base leading-5.5',
  secondary: 'text-sm leading-5',
  caption: 'text-xs leading-4',
  code: 'font-mono text-[13px] leading-5',
  mono: 'font-mono text-xs leading-4',
};

const headings = new Set<keyof typeof variants>([
  'largeTitle',
  'title',
  'headline',
]);

const defaultWeights = {
  largeTitle: 'bold',
  title: 'semibold',
  headline: 'semibold',
  body: 'normal',
  secondary: 'normal',
  caption: 'normal',
  code: 'normal',
  mono: 'normal',
} as const;

const tones = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  destructive: 'text-destructive',
  brand: 'text-brand',
  brandForeground: 'text-brand-foreground',
  add: 'text-add-fg',
  del: 'text-del-fg',
  primaryForeground: 'text-primary-foreground',
  secondaryForeground: 'text-secondary-foreground',
};

const weights = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

type TextProps = Omit<NativeTextProps, 'style'> & {
  variant?: keyof typeof variants;
  tone?: keyof typeof tones;
  weight?: keyof typeof weights;
  decoration?: 'line-through' | undefined;
  mark?: 'code' | undefined;
};

export function Text({
  variant = 'body',
  tone = 'default',
  weight,
  decoration,
  mark,
  className,
  accessibilityRole,
  ...props
}: TextProps) {
  return (
    <NativeText
      {...props}
      accessibilityRole={
        accessibilityRole ?? (headings.has(variant) ? 'header' : undefined)
      }
      className={[
        variants[variant],
        tones[tone],
        weights[weight ?? defaultWeights[variant]],
        decoration ?? '',
        mark === 'code' ? 'bg-muted font-mono' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
