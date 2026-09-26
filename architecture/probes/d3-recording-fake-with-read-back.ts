import type { Probe } from '../probe.ts';

export default {
  decision: 'D3',
  plants:
    'the files file-reader fake is named Recording although FileReader answers reads',
  gate: 'arch',
  rule: 'recording-fake-for-write-only-port:',
  edits: [
    {
      kind: 'replace',
      path: 'packages/files/spec/fakes/in-memory-file-reader.ts',
      old: 'export class InMemoryFileReader implements FileReader',
      new: 'export class RecordingFileReader implements FileReader',
    },
  ],
} satisfies Probe;
