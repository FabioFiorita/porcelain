import { Effect, Layer } from 'effect';
import { ChangeStatusReader } from '@porcelain/changes/ports';
import { WalkthroughHeadReader } from '@porcelain/walkthroughs/ports';
export const gitWalkthroughHeadReaderLayer = Layer.effect(
  WalkthroughHeadReader,
  Effect.gen(function* () {
    const status = yield* ChangeStatusReader;
    return WalkthroughHeadReader.of({
      read: Effect.fn('WalkthroughHeadReader.read')(function* (input) {
        const head = yield* status.readStatus(input);
        return { branch: head.branch?.name, headOid: head.headOid };
      }),
    });
  }),
);
