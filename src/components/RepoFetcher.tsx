import { useState } from 'react';
import { parseRepositoryUrl } from '@/lib/repo-fetcher';

export type RepoLoadState = 'idle' | 'loading' | 'ready' | 'error';

type RepoFetcherProps = {
  onSubmit: (repositoryUrl: string) => Promise<void>;
  state: RepoLoadState;
};

const STATUS_COLORS: Record<RepoLoadState, string> = {
  idle: 'bg-slate-800 text-slate-300',
  loading: 'bg-amber-500/20 text-amber-200 border border-amber-400/40',
  ready: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40',
  error: 'bg-rose-500/20 text-rose-200 border border-rose-400/40',
};

export default function RepoFetcher({ onSubmit, state }: RepoFetcherProps) {
  const [repository, setRepository] = useState('https://github.com/rust-lang/rust');
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationMessage(null);
    try {
      parseRepositoryUrl(repository);
      await onSubmit(repository);
    } catch (error) {
      setValidationMessage(error instanceof Error ? error.message : 'Invalid repository URL');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-slate-200" htmlFor="repo-url">
          Repository URL
        </label>
        <input
          id="repo-url"
          data-testid="repo-url-input"
          type="url"
          required
          value={repository}
          placeholder="https://github.com/owner/repo"
          onChange={(event) => setRepository(event.target.value)}
          disabled={state === 'loading'}
          className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-base text-slate-100 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/40 disabled:opacity-70"
        />
        <p className={`text-sm ${validationMessage ? 'text-rose-300' : 'text-slate-400'}`}>
          {validationMessage ?? 'Supports GitHub, GitLab, and Bitbucket public repositories.'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="primary-btn px-5 py-2"
          disabled={state === 'loading'}
        >
          {state === 'loading' ? 'Analysing…' : 'Generate Mind Map'}
        </button>
        <span className={`badge ${STATUS_COLORS[state]}`}>{state.toUpperCase()}</span>
      </div>
    </form>
  );
}
