import { AccessApi } from '../access/api.ts';
import { ChangesApi } from '../changes/api.ts';
import { FilesApi } from '../files/api.ts';
import { GitActionsApi } from '../git-actions/api.ts';
import { ProjectsApi } from '../projects/api.ts';
import { ReviewsApi } from '../reviews/api.ts';
import { porcelainApi } from './http-api.ts';

export class PorcelainClientApi extends porcelainApi
  .addHttpApi(AccessApi)
  .addHttpApi(ProjectsApi)
  .addHttpApi(FilesApi)
  .addHttpApi(ChangesApi)
  .addHttpApi(ReviewsApi)
  .addHttpApi(GitActionsApi) {}
