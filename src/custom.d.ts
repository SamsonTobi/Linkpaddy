/// <reference types="chrome" />

declare const chrome: typeof window.chrome;

declare const process: {
  env: Record<string, string | undefined>;
};

declare module "*.png" {
  const content: string;
  export default content;
}

declare module "*.woff2" {
  const content: string;
  export default content;
}
