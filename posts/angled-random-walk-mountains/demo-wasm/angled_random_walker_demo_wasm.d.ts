/* tslint:disable */
/* eslint-disable */
/**
* @param {number} size
* @param {number} max_long_age
* @param {number} max_short_age
* @param {number} max_generations
* @param {number} children
* @param {number} max_long_angle_divergence
* @param {number} max_short_angle_divergence
* @param {number} short_branch_frequency
* @param {Uint8Array} seed_bytes
* @returns {Uint8Array}
*/
export function generate(size: number, max_long_age: number, max_short_age: number, max_generations: number, children: number, max_long_angle_divergence: number, max_short_angle_divergence: number, short_branch_frequency: number, seed_bytes: Uint8Array): Uint8Array;
/**
* @param {Uint8Array} data
* @returns {Uint8Array}
*/
export function to_image(data: Uint8Array): Uint8Array;
/**
* @param {Uint8Array} data
* @param {number} radius
* @param {number} detail_max
* @returns {Uint8Array}
*/
export function heightmap_blur(data: Uint8Array, radius: number, detail_max: number): Uint8Array;
/**
* @returns {number}
*/
export function hello(): number;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly generate: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => void;
  readonly to_image: (a: number, b: number, c: number) => void;
  readonly heightmap_blur: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly hello: () => number;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {SyncInitInput} module
*
* @returns {InitOutput}
*/
export function initSync(module: SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;
