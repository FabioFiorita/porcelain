export const githubHeadLookupMessage =
  'Use resolveWorkflowPullRequest from ci/github.ts, because CI must bind a pull request to the workflow head repository, branch, commit and expected base.';

export function githubHeadLookupEndpoint(endpoint: string) {
  return /(?:^|\/)commits\/[^/?]+\/pulls(?:[?#]|$)|(?:^|\/)pulls\?(?:[^&#]*&)*head=/.test(
    endpoint,
  );
}

export function githubHeadLookupArgs(args: readonly string[]) {
  if (args[0] === 'pr' && args[1] === 'list')
    return args.slice(2).some((arg) => /^(?:--head|-H)(?:=|$)/.test(arg));
  return (
    args[0] === 'api' &&
    args
      .slice(1)
      .some((arg, index) =>
        /^(-[fF]|--(?:raw-)?field)$/.test(arg)
          ? args[index + 2]?.startsWith('head=') === true
          : /^(?:-[fF]|--(?:raw-)?field=)head=/.test(arg),
      )
  );
}

export function githubHeadLookupCommand(command: string) {
  const [program, ...args] = command
    .trim()
    .replace(/^(?:(?:if|then|elif|while|until|!|command|exec)\s+)+/, '')
    .split(/[\s'"]+/);
  return (
    program === 'gh' &&
    (githubHeadLookupArgs(args) ||
      (args[0] === 'api' && args.slice(1).some(githubHeadLookupEndpoint)))
  );
}
