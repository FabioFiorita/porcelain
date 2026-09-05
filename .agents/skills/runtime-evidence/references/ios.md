# iOS

Run the iOS simulator on a Mac. Select the device needed for the task and reuse a compatible
development app when available. Connect it to the intended Metro server and development
Environment, which may run on another machine.

Rebuild only when native changes or a missing compatible app require it. Follow the shared
runtime guidance for interaction and validation.

Use the [development guide](../../../../docs/development.md#mobile-devices) for the iOS simulator
launcher on macOS and [mobile-dev.mjs](../../../../scripts/mobile-dev.mjs) for its current options.
Select the intended simulator with `PORCELAIN_IOS_SIMULATOR`.

Follow the [runtime skill](../SKILL.md) for device selection, ownership, and validation scope.
