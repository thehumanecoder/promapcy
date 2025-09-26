import type { RepositoryHost } from '@/lib/schema';

export type ParsedRepository = {
  host: RepositoryHost;
  owner: string;
  name: string;
  url: string;
};

const HOST_PATTERNS: Record<RepositoryHost, RegExp> = {
  github: /^https?:\/\/(www\.)?github\.com\/(?<owner>[\w.-]+)\/(?<name>[\w.-]+)(?:\.git)?\/?$/i,
  gitlab: /^https?:\/\/(www\.)?gitlab\.com\/(?<owner>[\w.-]+)\/(?<name>[\w.-]+)(?:\.git)?\/?$/i,
  bitbucket: /^https?:\/\/(www\.)?bitbucket\.org\/(?<owner>[\w.-]+)\/(?<name>[\w.-]+)(?:\.git)?\/?$/i,
};

export function parseRepositoryUrl(url: string): ParsedRepository {
  const trimmed = url.trim();

  for (const [host, pattern] of Object.entries(HOST_PATTERNS) as [RepositoryHost, RegExp][]) {
    const match = trimmed.match(pattern);
    if (match?.groups) {
      return {
        host,
        owner: match.groups.owner,
        name: match.groups.name,
        url: trimmed,
      };
    }
  }

  throw new Error('Only GitHub, GitLab, or Bitbucket repository URLs are supported.');
}

export async function fetchRepositoryMetadata(repo: ParsedRepository) {
  // Placeholder: will be replaced by host-specific fetch implementations.
  return Promise.resolve({
    defaultBranch: 'main',
    latestCommit: '0000000',
    files: [],
  });
}

export async function fetchRepositoryTree(url: string) {
  const parsed = parseRepositoryUrl(url);
  const metadata = await fetchRepositoryMetadata(parsed);
  return { parsed, metadata };
}
