# Mobile integration map

Start with the owning contract and nearby tests rather than a separate mobile API specification.
[Domain terms](../../../docs/glossary.md) are shared with the other clients.

| Concern | Source |
| --- | --- |
| Procedure inputs and outputs | [catalog](../../../packages/contracts/src/procedure-catalog.ts) and its domain imports |
| Live protocol | [session contracts](../../../packages/contracts/src/session/) |
| Shared recovery and connection semantics | [client sessions](../../../packages/client-runtime/src/session/) |
| React Native transport adapter | [daemon client](../src/lib/daemon/) |
| Saved Environments, pairing, and credentials | [remote feature](../src/features/remote/) |
| Repository selection | [projects feature](../src/features/projects/) |
| Native terminal | [module and provenance](../modules/porcelain-terminal/README.md) |

Daemon paths refer to the host's filesystem, never the phone's. Credentials belong in secure
storage; pairing does not give the device the host's administrator credential. Shared protocol
behavior belongs in contracts and client-runtime so clients do not acquire incompatible variants.

For host administration, use [remote operations](../../../docs/remote-access.md).
