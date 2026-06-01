export const OPERATIONAL_LAUNCH_RECEIPT_SCHEMA: "jium-operational-launch-receipt-v1";
export const OPERATIONAL_LAUNCH_RECEIPT_DIR: "dist/operational-launch-receipt";
export const OPERATIONAL_LAUNCH_RECEIPT_JSON: "operational-launch-receipt.json";
export const OPERATIONAL_LAUNCH_RECEIPT_MARKDOWN: "operational-launch-receipt.md";

export function buildOperationalLaunchReceipt(options?: {
  root?: string;
  inputPath?: string;
  commandPacketPath?: string;
  envPath?: string;
  platform?: string;
  generatedAt?: string;
  now?: number;
}): Promise<any>;

export function writeOperationalLaunchReceiptFiles(options?: {
  root?: string;
  receipt: any;
  outputPath?: string;
  format?: "json" | "markdown";
}): {
  reportDir: string;
  reportDirRelative: string;
  jsonPath: string;
  markdownPath: string;
  jsonPathRelative: string;
  markdownPathRelative: string;
};

export function formatOperationalLaunchReceiptMarkdown(receipt: any): string;
