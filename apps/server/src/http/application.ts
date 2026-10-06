import type { PairedRequest, ClientRequest } from '@porcelain/contracts/shared';
import type { Layer } from 'effect';
import type { HttpRouter, HttpServer } from 'effect/http';

export type HttpApplication = Layer.Layer<
  never,
  never,
  | HttpRouter.HttpRouter
  | Layer.Success<typeof HttpServer.layerServices>
  | PairedRequest
  | ClientRequest
>;
