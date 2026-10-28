import {
  Text as NativeText,
  type TextProps as NativeTextProps,
} from 'react-native';

const variants = {
  body: 'text-base leading-6',
  ui: 'text-ui leading-5',
  caption: 'text-caption leading-5',
  small: 'text-2xs leading-4',
  heading: 'text-xl leading-7',
  subheading: 'text-sm leading-5',
  code: 'text-ui leading-5',
  link: 'text-ui leading-5 underline',
  navigatorTitle: 'text-sm leading-5',
  navigatorPhoneTitle: 'text-base leading-5.25 tracking-[-0.01em]',
  navigatorCaption: 'text-ui leading-4.5',
  navigatorProgress: 'text-ui leading-5 tabular-nums',
  navigatorPhoneProgress: 'text-sm leading-5.25 tabular-nums',
  navigatorCount: 'text-ui leading-4.5 tabular-nums',
};

const tones = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  destructive: 'text-destructive',
  card: 'text-card-foreground',
  primary: 'text-primary',
  brand: 'text-brand',
  primaryForeground: 'text-primary-foreground',
  secondaryForeground: 'text-secondary-foreground',
};

const weights = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
};

type TextProps = Omit<NativeTextProps, 'style'> & {
  variant?: keyof typeof variants;
  tone?: keyof typeof tones;
  weight?: keyof typeof weights;
};

export function Text({
  variant = 'body',
  tone = 'default',
  weight,
  className,
  accessibilityRole,
  ...props
}: TextProps) {
  const heading = variant === 'heading' || variant === 'subheading';
  const defaultWeight =
    variant === 'heading'
      ? 'semibold'
      : variant === 'subheading'
        ? 'medium'
        : 'normal';
  return (
    <NativeText
      {...props}
      accessibilityRole={accessibilityRole ?? (heading ? 'header' : undefined)}
      className={[
        variant === 'code' ? 'font-mono' : 'font-sans',
        variants[variant],
        tones[tone],
        weights[weight ?? defaultWeight],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
