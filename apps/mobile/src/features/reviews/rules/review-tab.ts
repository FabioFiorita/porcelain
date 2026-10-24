export type ReviewTab =
  | { readonly title: 'Review'; readonly progress: string | undefined }
  | { readonly title: 'Changes'; readonly progress: undefined };

export function reviewTab(
  published: boolean | undefined,
  decisions: readonly { readonly reviewed: boolean }[] | undefined,
): ReviewTab {
  if (published === false) return { title: 'Changes', progress: undefined };
  if (!decisions || decisions.length === 0)
    return { title: 'Review', progress: undefined };
  return {
    title: 'Review',
    progress: `${decisions.filter((decision) => decision.reviewed).length}/${decisions.length}`,
  };
}
