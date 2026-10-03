export function buildIdentity(variant: string | undefined) {
  switch (variant ?? 'development') {
    case 'production':
      return {
        name: 'Porcelain',
        bundleIdentifier: 'com.fabiofiorita.porcelain',
        scheme: 'porcelain',
      };
    case 'preview':
      return {
        name: 'Porcelain Preview',
        bundleIdentifier: 'com.fabiofiorita.porcelain.preview',
        scheme: 'porcelain.preview',
      };
    case 'development':
      return {
        name: 'Porcelain Dev',
        bundleIdentifier: 'com.fabiofiorita.porcelain.dev',
        scheme: 'porcelain.dev',
      };
    default:
      throw new Error(`Unknown mobile build variant: ${variant}`);
  }
}
