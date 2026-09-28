import { useConnectedContext } from '@/app/workspace-provider';
import {
  CommitForm as GitCommitForm,
  type CommitFormProps,
} from '@/features/git-actions/index';

export function CommitForm(props: CommitFormProps) {
  return <GitCommitForm {...props} context={useConnectedContext()} />;
}
