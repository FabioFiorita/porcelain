import { Crypto, Effect, Layer, PlatformError } from 'effect';
import { CryptoDigestAlgorithm, digest, getRandomBytes } from 'expo-crypto';

export const cryptoLayer = Layer.succeed(
  Crypto.Crypto,
  Crypto.make({
    randomBytes: getRandomBytes,
    digest: (algorithm, data) =>
      Effect.tryPromise({
        try: () =>
          digest(
            {
              'SHA-1': CryptoDigestAlgorithm.SHA1,
              'SHA-256': CryptoDigestAlgorithm.SHA256,
              'SHA-384': CryptoDigestAlgorithm.SHA384,
              'SHA-512': CryptoDigestAlgorithm.SHA512,
            }[algorithm],
            new Uint8Array(data),
          ),
        catch: (cause) =>
          PlatformError.systemError({
            module: 'Crypto',
            method: 'digest',
            _tag: 'Unknown',
            description: 'Could not compute digest',
            cause,
          }),
      }).pipe(Effect.map((buffer) => new Uint8Array(buffer))),
  }),
);
