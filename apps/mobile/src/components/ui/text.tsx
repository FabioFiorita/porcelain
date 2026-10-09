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
  code: 'text-ui leading-5 font-mono',
  link: 'text-ui leading-5 underline',
};

const tones = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  destructive: 'text-destructive',
  card: 'text-card-foreground',
  primary: 'text-primary',
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
