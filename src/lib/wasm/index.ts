import type { AnalysisResult, MindMapGraph } from '@/lib/schema';

type WasmExports = {
  wasm_graph_from_source: (source: string) => string;
  wasm_graph_from_repo: (url: string) => string;
};

type WasmModule = WasmExports & {
  default?: (input?: RequestInfo | URL | string) => Promise<unknown>;
};

let wasmModulePromise: Promise<WasmExports> | null = null;

const WASM_BOOTSTRAP_PATH = '/wasm/promapcy_wasm.js';
const WASM_BINARY_PATH = '/wasm/promapcy_wasm_bg.wasm';

function isBrowserEnvironment(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

async function initialiseWasm(module: WasmModule, wasmBinaryUrl: string): Promise<boolean> {
  if (typeof module.default !== 'function') {
    return true;
  }

  try {
    await module.default(wasmBinaryUrl);
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

async function loadCompiledWasm(): Promise<WasmExports | null> {
  if (!isBrowserEnvironment()) {
    return null;
  }

  try {
    const module = (await import(/* webpackIgnore: true */ WASM_BOOTSTRAP_PATH)) as WasmModule;
    const initialised = await initialiseWasm(module, WASM_BINARY_PATH);

    if (!initialised) {
      return null;
    }

    return module;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Falling back to mock WASM implementation', error);
    }
    return null;
  }
}

async function importWasmModule(): Promise<WasmExports> {
  const compiledModule = await loadCompiledWasm();

  if (compiledModule) {
    return compiledModule;
  }

  const mock = await import('./mock-wasm');
  return mock as unknown as WasmExports;
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
