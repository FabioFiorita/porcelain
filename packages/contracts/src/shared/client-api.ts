import { WalkthroughsApi } from '../walkthroughs/api.ts';
import { AccessApi } from '../access/api.ts';
import { ChangesApi } from '../changes/api.ts';
import { FilesApi } from '../files/api.ts';
import { GitActionsApi } from '../git-actions/api.ts';
import { ProjectsApi } from '../projects/api.ts';
import { ReviewedFilesApi } from '../changes/reviewed-api.ts';
import { PullRequestsApi } from '../projects/pull-requests-api.ts';
import { porcelainApi } from './http-api.ts';

export class PorcelainClientApi extends porcelainApi
  .addHttpApi(WalkthroughsApi)
  .addHttpApi(AccessApi)
  .addHttpApi(ProjectsApi)
  .addHttpApi(FilesApi)
  .addHttpApi(ChangesApi)
  .addHttpApi(ReviewedFilesApi)
  .addHttpApi(PullRequestsApi)
  .addHttpApi(GitActionsApi) {}
