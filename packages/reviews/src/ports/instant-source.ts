export interface InstantSource {
  after(input: { instant: string; milliseconds: number }): string;
}
