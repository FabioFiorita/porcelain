import {
  readServiceUpdateResponseSchema,
  startServiceUpdateResponseSchema,
} from '@porcelain/contracts/access';
import {
  apiError,
  defineCase,
  defineFeature,
  invalidRequest,
  record,
  text,
  type Session,
} from '../scripts/feature.ts';
import { eventually, read } from '../scripts/fixture.ts';

const updatePath = '/api/service/update';
const status = { method: 'GET' as const, path: updatePath };
const start = (version: unknown, headers?: Record<string, string>) => ({
  method: 'POST' as const,
  path: updatePath,
  body: { version },
  ...(headers ? { headers } : {}),
});
const notOffered = apiError(
  409,
  'Conflict',
  'That version is not the newer version this server offers',
);
const alreadyRunning = apiError(
  409,
  'Conflict',
  'An update is already running',
);
const untrusted = apiError(
  403,
  'Forbidden',
  'An owner must trust this device on the computer that runs Porcelain before it can update Porcelain',
);
const settled = (body: Record<string, unknown>) => body.running === false;
const offered = async (session: Session) => read(session, status);

export default defineFeature({
  feature: 'access.service-update',
  reaches: ['GET /api/service/update', 'POST /api/service/update'],
  paired: true,
  intent: 'intended',
  behaviour:
    "Every paired device reads which version of Porcelain runs, whether it runs as the installed service, the newest published version and whether it is newer, whether an update runs now, and how the last update went. A paired browser on the computer that runs Porcelain starts an update to the newer version the server offers; the server accepts it at once, reports its progress from downloading through installing and restarting, and ends updated on the new version, or failed with the reason while it keeps running the version it had. Only the offered version can be installed and one update runs at a time. A request that did not come from this computer's loopback listener, such as one a proxy on this computer relayed, is refused unless the owner trusts the device that sends it (access.trusted-update). The update itself belongs to the installed service's updater, which this net replaces with a scripted one: its first update fails and its second succeeds.",
  cases: [
    defineCase({
      name: 'the server offers its newer version',
      request: () => status,
      expect({ response, check, checkPartial, checkContract }) {
        check('status', 200, response.status);
        checkContract(
          'contract',
          readServiceUpdateResponseSchema,
          response.body,
        );
        checkPartial(
          'a newer version is offered and nothing runs',
          { managed: true, available: true, running: false, last: null },
          response.body,
        );
      },
    }),
    defineCase({
      name: 'a version other than the offered one, a malformed body and a relayed request from an untrusted device are refused',
      setup: offered,
      request: (_, state) => [
        start('99.0.0'),
        start(''),
        start(state.latest, { 'x-forwarded-for': '203.0.113.9' }),
      ],
      async expect({ responses, state, session, check }) {
        check(
          'statuses',
          [409, 400, 403],
          responses.map((entry) => entry.status),
        );
        check('not offered', notOffered, responses[0]?.body);
        check('malformed', invalidRequest, responses[1]?.body);
        check('remote', untrusted, responses[2]?.body);
        check('nothing started', state, await read(session, status));
      },
    }),
    defineCase({
      name: 'an update that fails says why and keeps the running version',
      setup: offered,
      request: (_, state) => [start(state.latest), start(state.latest)],
      async expect({
        responses,
        state,
        session,
        check,
        checkContract,
        checkMatch,
        checkPartial,
      }) {
        check(
          'statuses',
          [202, 409],
          responses.map((entry) => entry.status),
        );
        checkContract(
          'contract',
          startServiceUpdateResponseSchema,
          responses[0]?.body,
        );
        checkPartial(
          'accepted and downloading',
          {
            running: true,
            last: {
              from: state.version,
              target: state.latest,
              stage: 'downloading',
            },
          },
          responses[0]?.body,
        );
        check('one at a time', alreadyRunning, responses[1]?.body);
        const ended = await eventually(session, status, settled);
        checkPartial(
          'failed on the version it had',
          {
            version: state.version,
            available: true,
            last: { target: state.latest, stage: 'failed' },
          },
          ended,
        );
        checkMatch('why', /\S/u, text(record(ended.last).reason));
      },
    }),
    defineCase({
      name: 'an update that succeeds ends on the new version',
      setup: offered,
      request: (_, state) => start(state.latest),
      async expect({ response, state, session, check, checkPartial }) {
        check('status', 202, response.status);
        checkPartial(
          'accepted',
          { running: true, last: { stage: 'downloading' } },
          response.body,
        );
        const ended = await eventually(session, status, settled);
        check(
          'updated',
          {
            managed: true,
            version: state.latest,
            latest: state.latest,
            available: false,
            running: false,
            last: {
              from: state.version,
              target: state.latest,
              stage: 'updated',
              reason: null,
            },
          },
          ended,
        );
      },
    }),
  ],
});
