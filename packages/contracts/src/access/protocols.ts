import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/http-api';
import { porcelainApi } from '../shared/http-api.ts';
import { PairedRequest } from '../shared/http-caller.ts';
import {
  liveUpdatesQuerySchema,
  liveUpgradeResponseSchema,
} from './live-updates.ts';

export class LiveUpdatesApi extends porcelainApi.add(
  HttpApiGroup.make('live')
    .add(
      HttpApiEndpoint.get('liveUpdates', '/api/live', {
        disableCodecs: true,
        query: liveUpdatesQuerySchema.fields,
        success: liveUpgradeResponseSchema.pipe(
          HttpApiSchema.asNoContent({ decode: () => undefined }),
          HttpApiSchema.status('SwitchingProtocols'),
        ),
      }),
    )
    .middleware(PairedRequest),
) {}
