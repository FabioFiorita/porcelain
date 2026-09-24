export interface SignatureSource {
  sign(input: { secret: string; message: string }): string;
}
