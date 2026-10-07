import * as shared from '@porcelain/contracts/shared';
import * as access from '@porcelain/contracts/access';
import * as changes from '@porcelain/contracts/changes';
import * as files from '@porcelain/contracts/files';
import * as gitActions from '@porcelain/contracts/git-actions';
import * as projects from '@porcelain/contracts/projects';
import * as reviews from '@porcelain/contracts/reviews';
import { HttpApi } from 'effect/http-api';

export function featureApiRoutes(): string[] {
  const apis: HttpApi.Top[] = [];
  for (const value of Object.values({
    ...shared,
    ...access,
    ...changes,
    ...files,
    ...gitActions,
    ...projects,
    ...reviews,
  }))
    if (HttpApi.isHttpApi(value)) apis.push(value);
  return [
    ...new Set(
      apis.flatMap((api) =>
        Object.values(api.groups).flatMap((group) =>
          Object.values(group.endpoints).map(
            (endpoint) => `${endpoint.method} ${endpoint.path}`,
          ),
        ),
      ),
    ),
  ].toSorted();
}
