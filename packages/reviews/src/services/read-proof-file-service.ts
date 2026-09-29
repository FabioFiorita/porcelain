import { encodeBase64 } from '@porcelain/kernel/rules';
import { ProofFileNotFoundError } from '../errors/proof-file-not-found-error.ts';
import type {
  ReadProofFileInput,
  ReadProofFileOptions,
  ReadProofFileResult,
} from '../models/read-proof-file.ts';
import type { ReviewStore } from '../ports/review-store.ts';

export class ReadProofFileService {
  private readonly reviews: ReviewStore;
  private readonly options: ReadProofFileOptions;

  constructor(reviews: ReviewStore, options: ReadProofFileOptions) {
    this.reviews = reviews;
    this.options = options;
  }

  execute(input: ReadProofFileInput): ReadProofFileResult {
    const file = this.reviews.readProofFile(input);
    if (file === undefined) throw new ProofFileNotFoundError();
    return {
      id: file.id,
      mediaType: file.mediaType,
      base64: encodeBase64(file.bytes, this.options.base64ChunkBytes),
    };
  }
}
