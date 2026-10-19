import { Context } from 'effect';

export const ReviewLinkOptions = Context.Service<
  '@porcelain/server/ReviewLinkOptions',
  {
    hubOrigin: string;
    localHost: string;
    localPort: number;
  }
>('@porcelain/server/ReviewLinkOptions');
