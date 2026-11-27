import { useLocalSearchParams } from 'expo-router';
import { MergePullRequestSheet } from '../features/workspace/index';

export default function MergePullRequestRoute() {
  return <MergePullRequestSheet params={useLocalSearchParams()} />;
}
