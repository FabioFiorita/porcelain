export type PostNotice = { text: string; copy: boolean };

export function stillSavedNotice(count: number): PostNotice {
  return {
    text:
      count === 1
        ? 'One comment is still saved: it belongs to a different repository.'
        : `${count} comments are still saved: they belong to a different repository.`,
    copy: false,
  };
}
