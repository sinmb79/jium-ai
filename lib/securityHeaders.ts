import securityHeadersData from "./securityHeadersData.json";

export type SecurityHeader = {
  key: string;
  value: string;
};

export const ENFORCED_CSP: string = securityHeadersData.enforcedCsp;

export const REPORT_ONLY_CSP: string = securityHeadersData.reportOnlyCsp;

const BASE_SECURITY_HEADERS: SecurityHeader[] = securityHeadersData.baseHeaders.map((header) => ({
  key: header.key,
  value: header.value,
}));

export const SECURITY_HEADERS: SecurityHeader[] = [
  ...BASE_SECURITY_HEADERS,
  {
    key: "Content-Security-Policy",
    value: ENFORCED_CSP,
  },
  {
    key: "Content-Security-Policy-Report-Only",
    value: REPORT_ONLY_CSP,
  },
];

export function buildStaticHeadersFile(pathPattern = "/*") {
  return [`${pathPattern}`, ...SECURITY_HEADERS.map((header) => `  ${header.key}: ${header.value}`), ""].join("\n");
}
