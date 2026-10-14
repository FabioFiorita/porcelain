import { DestinationLayout } from '../../shell/destination-layout';

export const unstable_settings = { anchor: 'files' };

function FilesLayout() {
  return <DestinationLayout name="files" title="Files" />;
}

export { FilesLayout as default };
