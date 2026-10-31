import { setStringAsync } from 'expo-clipboard';

export function copyToClipboard(value: string) {
  return setStringAsync(value);
}
