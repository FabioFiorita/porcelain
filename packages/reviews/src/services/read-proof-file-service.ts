import { ReadProofFileOptions } from '../ports/read-proof-file-options.ts';
import { Effect, Context, Layer } from 'effect';
import { encodeBase64 } from '@porcelain/kernel/rules';
import { ProofFileNotFoundError } from '../errors/proof-file-not-found-error.ts';
import {
  type ReadProofFileInput,
  type ReadProofFileResult,
} from '../models/read-proof-file.ts';
import { ReviewStore } from '../ports/review-store.ts';

export class ReadProofFileService extends Context.Service<
  ReadProofFileService,
  {
    readonly execute: (
      input: ReadProofFileInput,
    ) => Effect.Effect<ReadProofFileResult, ProofFileNotFoundError>;
  }
>()('@porcelain/reviews/ReadProofFileService') {
  static readonly layer = Layer.effect(
    ReadProofFileService,
    Effect.gen(function* () {
      const reviewsCapability = yield* ReviewStore;
      const optionsCapability = yield* ReadProofFileOptions;

      return {
        execute: Effect.fn('ReadProofFileService.execute')(function* (
          input: ReadProofFileInput,
        ): Effect.fn.Return<ReadProofFileResult, ProofFileNotFoundError> {
          const file = yield* reviewsCapability.readProofFile(input);
          if (file === undefined)
            return yield* Effect.fail(new ProofFileNotFoundError());
          return {
            id: file.id,
            mediaType: file.mediaType,
            base64: encodeBase64(
              file.bytes,
              optionsCapability.base64ChunkBytes,
            ),
          };
        }),
      };
    }),
  );
}
