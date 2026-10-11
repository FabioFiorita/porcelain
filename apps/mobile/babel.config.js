export default function babelConfig(api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        { 'react-compiler': { panicThreshold: 'all_errors' } },
      ],
    ],
  };
}
