# Web client layers

Views compose components, own drafts and selection interactions, and call query hooks. Query hooks own API calls, cache identity, refresh consequences, and safe errors. Domain modules contain pure presentation rules. API adapters implement cohesive ports and delegate portable transport and contract validation to `packages/client`. Routes own URL validation; bootstrap owns providers and adapter selection.

The workspace provider owns the paired browser session and cancellation independently of view lifetimes. Query keys have one owner and never contain credentials. Disconnect aborts outstanding work, clears Query state, and removes navigation selection. Uncertain Git operations live in a connection-owned store so their request IDs survive navigation but disappear with that connection.

Development uses the real disposable server. API mocks remain controlled fixtures for view behavior; they do not establish persistence, authentication, or Git correctness. Import boundaries enforce the layer direction, while focused behavior tests protect consequences the import graph cannot express.
