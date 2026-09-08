export type GitProcessResult = {
  stdout: Buffer;
  exitCode: number | null;
  started: boolean;
  interrupted: boolean;
  descendantsStopped: boolean;
};
