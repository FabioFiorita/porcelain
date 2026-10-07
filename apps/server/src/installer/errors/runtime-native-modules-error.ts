import { Schema } from 'effect';

export class RuntimeNativeModulesError extends Schema.TaggedError<RuntimeNativeModulesError>()(
  'RuntimeNativeModulesError',
  {
    detail: Schema.String,
  },
) {
  override get message() {
    return `The persistent runtime cannot load its native modules (node:sqlite, @parcel/watcher): ${this.detail}`;
  }
}
