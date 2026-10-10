import { useState } from 'react';
import { openURL } from 'expo-linking';

export function usePreviewLink() {
  const [error, setError] = useState('');
  return {
    error,
    open: (url: string) => {
      void openURL(url).catch(() => setError('This link could not be opened.'));
    },
  };
}
