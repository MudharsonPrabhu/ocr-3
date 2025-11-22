declare module "tesseract.js" {
  // Minimal typings to satisfy TypeScript when official types are missing.
  // Expand these if you need more specific typing for worker methods.
  export type Worker = any;

  export interface CreateWorkerOptions {
    /** language(s) to load, e.g. 'eng' or ['eng','fra'] */
    lang?: string | string[];
    /** number of workers or concurrency hints */
    [key: string]: any;
  }

  export function createWorker(...args: any[]): Promise<Worker>;

  const _default: {
    createWorker: (...args: any[]) => Promise<Worker>;
    [key: string]: any;
  };

  export default _default;
}
