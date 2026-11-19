export const isImagePath = (path: string) =>
  /\.(png|jpe?g|gif|webp|avif|svg|ico)$/i.test(path);

export const isKnownBinaryPath = (path: string) =>
  isImagePath(path) ||
  /\.(bmp|heic|heif|tiff?|pdf|zip|gz|7z|rar|woff2?|ttf|otf|mp3|mp4|m4a|wav|mov|webm|wasm)$/i.test(
    path,
  );
