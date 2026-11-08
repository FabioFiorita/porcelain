import { Layer } from 'effect';
import { SecureRandom } from 'effect/crypto';
import { getRandomBytes } from 'expo-crypto';

export const secureRandomLayer = Layer.succeed(
  SecureRandom.SecureRandom,
  SecureRandom.make(getRandomBytes),
);
