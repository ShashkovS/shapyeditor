/* tslint:disable */
/* eslint-disable */
export function run(): void;
export enum PositionEncoding {
  Utf8 = 0,
  Utf16 = 1,
  Utf32 = 2,
}

export interface Diagnostic {
    code: string | null;
    message: string;
    start_location: {
        row: number;
        column: number;
    };
    end_location: {
        row: number;
        column: number;
    };
    fix: {
        message: string | null;
        edits: {
            content: string | null;
            location: {
                row: number;
                column: number;
            };
            end_location: {
                row: number;
                column: number;
            };
        }[];
    } | null;
}


export class Workspace {
  free(): void;
  static version(): string;
  constructor(options: any, position_encoding: PositionEncoding);
  static defaultSettings(): any;
  check(contents: string): any;
  format(contents: string): string;
  format_ir(contents: string): string;
  comments(contents: string): string;
  /**
   * Parses the content and returns its AST
   */
  parse(contents: string): string;
  tokens(contents: string): string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly run: () => void;
  readonly __wbg_workspace_free: (a: number, b: number) => void;
  readonly workspace_version: () => [number, number];
  readonly workspace_new: (a: any, b: number) => [number, number, number];
  readonly workspace_defaultSettings: () => [number, number, number];
  readonly workspace_check: (a: number, b: number, c: number) => [number, number, number];
  readonly workspace_format: (a: number, b: number, c: number) => [number, number, number, number];
  readonly workspace_format_ir: (a: number, b: number, c: number) => [number, number, number, number];
  readonly workspace_comments: (a: number, b: number, c: number) => [number, number, number, number];
  readonly workspace_parse: (a: number, b: number, c: number) => [number, number, number, number];
  readonly workspace_tokens: (a: number, b: number, c: number) => [number, number, number, number];
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_4: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
