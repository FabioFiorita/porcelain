import type { DiscoveredRepository } from './discovered-repository.ts';
import type { DiscoveryIssue } from './discovery-issue.ts';

export type DiscoveryResult = {
  repository: DiscoveredRepository;
  issues: DiscoveryIssue[];
};
