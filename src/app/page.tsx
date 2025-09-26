'use client';

import { useState } from 'react';
import MindMapCanvas from '@/components/MindMapCanvas';
import RepoFetcher, { RepoLoadState } from '@/components/RepoFetcher';
import type { MindMapGraph } from '@/lib/schema';

export default function HomePage() {
  const [graph, setGraph] = useState<MindMapGraph | null>(null);
  const [repoState, setRepoState] = useState<RepoLoadState>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleRepoLoad = async (url: string) => {
    setError(null);
    setRepoState('loading');
    try {
      const { graph: repoGraph } = await import('@/lib/wasm').then(async (module) => {
        const wasm = await module.loadAnalyzer();
        return module.analyzeRepository(wasm, url);
      });
      setGraph(repoGraph);
      setRepoState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyse repository');
      setRepoState('error');
      setGraph(null);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 pb-16 pt-14 sm:px-8 lg:px-12">
      <section className="flex flex-col gap-3 text-slate-200">
        <span className="text-xs uppercase tracking-[0.35em] text-brand-300">ProMapcy</span>
        <h1 className="text-4xl font-semibold text-slate-50 sm:text-5xl">Generate interactive code mind maps</h1>
        <p className="max-w-3xl text-base text-slate-300">
          Submit any public GitHub, GitLab, or Bitbucket repository to analyse its structure down to variables and
          constants. We will parse the code and build an interactive mind map you can explore.
        </p>
      </section>

      <section className="grid gap-8 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <div className="card p-6">
          <RepoFetcher onSubmit={handleRepoLoad} state={repoState} />
        </div>

        <div className="card flex min-h-[24rem] flex-col p-6" data-testid="mindmap-panel">
          {repoState === 'loading' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-slate-300">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-600 border-t-brand-400" aria-label="Loading" />
              <p className="text-sm">Analysing repository…</p>
            </div>
          )}

          {repoState === 'error' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <div className="rounded-full bg-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-200">Analysis failed</div>
              <p className="max-w-md text-sm text-slate-300">{error ?? 'Unknown error'}</p>
              <p className="text-xs text-slate-500">Please verify the repository URL and try again.</p>
            </div>
          )}

          {repoState === 'ready' && graph && <MindMapCanvas graph={graph} />}

          {repoState === 'idle' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-slate-300">
              <div className="rounded-full bg-slate-800/70 px-4 py-2 text-xs font-semibold uppercase tracking-widest">
                Awaiting repository
              </div>
              <p className="max-w-md text-sm text-slate-400">
                Enter a public repository URL to generate its mind map.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
