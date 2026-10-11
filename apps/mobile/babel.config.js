export default function babelConfig(api) {
  api.cache(true);
  return {
    presets: [
      [
        'expo/internal/babel-preset',
        { 'react-compiler': { panicThreshold: 'all_errors' } },
      ],
    ],
  };
}
