# Server internal modularity

Git commands and server operations should make their execution flow easy to follow before
client development adds more consumers. Separate substantial parsing and validation from
orchestration using the existing responsibility layout: representation conversion belongs in
mappers, and supporting rules belong in scoped helpers when no more specific role applies.

Keep direct named imports and the existing explicit constructor dependencies. Helpers remain
internal to their owner; this is not a shared utilities package, a new service layer, or a reason
to extract every small private function. Composition continues to show concrete dependency wiring.
Existing behavior specs protect these refactors through their supported entry points.

The disposable playground supplies realistic review scenarios through the existing application
and HTTP APIs. The bundled Swagger explorer is removed because it did not provide a clear
workflow for understanding or exercising the product. Runtime request validation and response
serialization remain owned by the route schemas. A future API exploration interface needs its
own design; it is not part of this refactor.
