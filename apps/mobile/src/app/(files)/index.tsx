import { Redirect } from 'expo-router';

function FilesIndexRoute() {
  return <Redirect href="/files" />;
}

export { FilesIndexRoute as default };
