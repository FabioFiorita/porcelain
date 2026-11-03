import { CommitScreen } from '../../../features/history';

export default function TimelineCommitRoute() {
  return <CommitScreen diffRoute="/timeline-diff" returnTo="Files" />;
}
