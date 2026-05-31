import type { DiscoveryResearchPlan, DiscoveryResearchQuery } from "@/lib/discoveryResearchEngine";

export type SafeSearchProvider = "GOOGLE" | "NAVER" | "BING";

export type SafeSearchAction = {
  id: string;
  provider: SafeSearchProvider;
  label: string;
  query: string;
  url: string;
  purpose: string;
  boundary: string;
};

const PROVIDERS: Array<{ id: SafeSearchProvider; label: string; buildUrl: (query: string) => string }> = [
  {
    id: "GOOGLE",
    label: "Google",
    buildUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: "NAVER",
    label: "Naver",
    buildUrl: (query) => `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`,
  },
  {
    id: "BING",
    label: "Bing",
    buildUrl: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
  },
];

function compact(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function isUsableQuery(query: DiscoveryResearchQuery) {
  const value = compact(query.query);
  return Boolean(value) && !value.includes("[") && !value.includes("]") && query.authority === "VICTIM_SAFE";
}

export function buildSafeSearchActions(plan: DiscoveryResearchPlan, maxQueries = 4): SafeSearchAction[] {
  return plan.safeQueries
    .filter(isUsableQuery)
    .slice(0, maxQueries)
    .flatMap((query) =>
      PROVIDERS.map((provider) => ({
        id: `${provider.id.toLowerCase()}-${query.id}`,
        provider: provider.id,
        label: `${provider.label} 검색`,
        query: compact(query.query),
        url: provider.buildUrl(compact(query.query)),
        purpose: query.purpose,
        boundary: "검색 결과의 제목·스니펫·URL만 최소 확인하고, 피해물 원본을 열람·다운로드·재공유하지 않습니다.",
      })),
    );
}

export function unsafeSearchActionMarkers(actions: SafeSearchAction[]) {
  const serialized = JSON.stringify(actions).toLowerCase();
  return ["discord.gg/", "t.me/", ".onion/", "telegram.me/"].filter((marker) => serialized.includes(marker));
}
