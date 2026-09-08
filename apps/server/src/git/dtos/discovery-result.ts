import type { DiscoveredRepository } from './discovered-repository.ts';
import type { DiscoveryIssue } from './discovery-issue.ts';

export interface DiscoveryResult {
  repository: DiscoveredRepository;
  issues: DiscoveryIssue[];
}
