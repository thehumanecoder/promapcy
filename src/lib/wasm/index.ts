import type { AnalysisResult, MindMapGraph } from '@/lib/schema';

type WasmExports = {
  wasm_graph_from_source: (source: string) => string;
  wasm_graph_from_repo: (url: string) => string;
};

type WasmModule = WasmExports & {
  default?: (input?: RequestInfo | URL) => Promise<unknown>;
};

let wasmModulePromise: Promise<WasmExports> | null = null;

async function initialiseWasm(module: WasmModule): Promise<boolean> {
  if (typeof module.default !== 'function') {
    return true;
  }

  try {
    const wasmUrl = new URL('../../../wasm/pkg/promapcy_wasm_bg.wasm', import.meta.url);
    await module.default(wasmUrl);
    return true;
  } catch (assetError) {
    try {
      await module.default();
      return true;
    } catch (initialiseError) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Failed to initialise compiled WASM bundle, falling back to mock.', initialiseError);
      }
      return false;
    }
  }
}

async function importWasmModule(): Promise<WasmExports> {
  try {
    const module = (await import('../../../wasm/pkg')) as WasmModule;
    const initialised = await initialiseWasm(module);
    if (!initialised) {
      const mock = await import('./mock-wasm');
      return mock as unknown as WasmExports;
    }
    return module;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Falling back to mock WASM implementation', error);
    }
    const mock = await import('./mock-wasm');
    return mock as unknown as WasmExports;
  }
}

export async function loadAnalyzer(): Promise<WasmExports> {
  if (!wasmModulePromise) {
    wasmModulePromise = importWasmModule();
  }
  return wasmModulePromise;
}

export async function analyzeRepository(module: WasmExports, repositoryUrl: string): Promise<AnalysisResult> {
  const response = module.wasm_graph_from_repo(repositoryUrl);
  return JSON.parse(response) as AnalysisResult;
}

export async function analyzeSource(module: WasmExports, source: string): Promise<MindMapGraph> {
  const response = module.wasm_graph_from_source(source);
  return JSON.parse(response) as MindMapGraph;
}
