declare module "https://esm.sh/qrcode@1.5.3" {
  export function toCanvas(
    canvas: HTMLCanvasElement,
    value: string,
    options?: {
      width?: number;
      margin?: number;
    },
  ): Promise<void>;
}
