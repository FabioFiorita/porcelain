import { SettingsToolbar } from '../../../features/access';
import { WorktreesHome } from '../../../shell/worktrees-home';

export default function WorktreesRoute() {
  return (
    <>
      <SettingsToolbar />
      <WorktreesHome />
    </>
  );
}
