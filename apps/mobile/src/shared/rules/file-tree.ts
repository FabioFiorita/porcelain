import { isImagePath } from '@porcelain/client/files/rules';

export const isNativeImagePath = (path: string) =>
  isImagePath(path) && !/\.svg$/i.test(path);
