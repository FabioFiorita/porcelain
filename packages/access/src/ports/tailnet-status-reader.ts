import type { TailnetReport } from '../models/remote-access.ts';

export interface TailnetStatusReader {
  read(): Promise<TailnetReport>;
}
