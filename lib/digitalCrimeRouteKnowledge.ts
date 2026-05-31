import type { EvidenceItem, TraceSignalSeverity } from "@/lib/types";

export type RouteIndicatorSource =
  | "VICTIM_PROVIDED"
  | "OFFICIAL_PUBLIC_NOTICE"
  | "PLATFORM_TRANSPARENCY"
  | "AUTHORIZED_PARTNER_FEED"
  | "OPEN_WEB_METADATA";

export type RouteAccessLevel = "PUBLIC_GUIDANCE" | "RESTRICTED_CASE_INDICATOR" | "AUTHORIZED_INTEL_ONLY";

export type DigitalCrimeRoutePattern = {
  id: string;
  label: string;
  routeKind: string;
  riskLevel: TraceSignalSeverity;
  publicDescriptor: string;
  safeSignals: string[];
  evidenceToRecord: string[];
  doNotDo: string[];
  officialHandoff: string[];
  allowedIndicatorSources: RouteIndicatorSource[];
  accessLevel: RouteAccessLevel;
  intelligenceValue: string;
  handoffQuestion: string;
};

export type DigitalCrimeRouteMatch = DigitalCrimeRoutePattern & {
  matchedEvidenceIds: string[];
};

export const DIGITAL_CRIME_ROUTE_BOUNDARIES = [
  "Known criminal locations must not be displayed as a browseable directory.",
  "Exact URLs, invite links, account handles, and room names stay in the case evidence ledger or authorized feeds only.",
  "The app may match indicators and prepare handoff packets, but it must not infiltrate rooms, buy access, scrape victim material, or deanonymize people.",
  "Public route intelligence must keep provenance, last-checked date, access level, and a removal/reporting route.",
];

export const DIGITAL_CRIME_ROUTE_PATTERNS: DigitalCrimeRoutePattern[] = [
  {
    id: "mainstream-social-repost",
    label: "SNS/public profile repost route",
    routeKind: "PUBLIC_PLATFORM",
    riskLevel: "HIGH",
    publicDescriptor: "Open social profiles, short-form feeds, public comments, or profile impersonation pages.",
    safeSignals: ["sns", "social", "profile", "reels", "shorts", "public post", "impersonation", "fake account"],
    evidenceToRecord: ["Visible account name", "Post URL or screen location", "Posted time", "Report/takedown history"],
    doNotDo: ["Do not message the poster", "Do not accuse a real person from a handle alone", "Do not repost screenshots publicly"],
    officialHandoff: ["Platform report", "D4U deletion support", "ECRM when threat, coercion, stalking, or repeated posting is present"],
    allowedIndicatorSources: ["VICTIM_PROVIDED", "PLATFORM_TRANSPARENCY", "OPEN_WEB_METADATA"],
    accessLevel: "PUBLIC_GUIDANCE",
    intelligenceValue: "Fast platform classification helps prepare the right report form and preserves the visible posting timeline.",
    handoffQuestion: "Was the page publicly visible, and did the victim or supporter capture the account name and posted time?",
  },
  {
    id: "community-forum-imageboard",
    label: "Community/forum/imageboard route",
    routeKind: "PUBLIC_OR_SEMI_PUBLIC_BOARD",
    riskLevel: "HIGH",
    publicDescriptor: "Anonymous boards, forums, imageboards, comment threads, and repost communities.",
    safeSignals: ["forum", "board", "imageboard", "anonymous", "thread", "community", "comment thread"],
    evidenceToRecord: ["Thread title", "Board/category name", "Visible poster alias", "First discovery time", "Moderator report status"],
    doNotDo: ["Do not join harassment threads", "Do not preserve victim media by downloading it", "Do not reveal victim identity in replies"],
    officialHandoff: ["D4U deletion support", "KOCSC/KCSC blocking review", "ECRM if criminal conduct is suspected"],
    allowedIndicatorSources: ["VICTIM_PROVIDED", "OFFICIAL_PUBLIC_NOTICE", "OPEN_WEB_METADATA"],
    accessLevel: "PUBLIC_GUIDANCE",
    intelligenceValue: "Board/category metadata helps connect repeated reposts without asserting the offender's real identity.",
    handoffQuestion: "Is there a board/category path and a visible alias that can be captured without opening or saving the harmful content?",
  },
  {
    id: "encrypted-private-room",
    label: "Encrypted messenger/private-room route",
    routeKind: "PRIVATE_OR_INVITE_ONLY_CHANNEL",
    riskLevel: "CRITICAL",
    publicDescriptor: "Invite-only rooms, private channels, disappearing-message groups, or paid access claims.",
    safeSignals: ["telegram", "t.me", "invite", "private room", "secret room", "channel", "encrypted", "dm room", "paid room"],
    evidenceToRecord: ["Invite claim text", "Visible room/channel name if already known", "Threat message", "Who provided the information"],
    doNotDo: ["Do not infiltrate", "Do not buy access", "Do not request invite codes", "Do not download or forward abuse material"],
    officialHandoff: ["D4U urgent consultation", "ECRM/police handoff", "Legal counsel when threats or extortion exist"],
    allowedIndicatorSources: ["VICTIM_PROVIDED", "AUTHORIZED_PARTNER_FEED", "OFFICIAL_PUBLIC_NOTICE"],
    accessLevel: "AUTHORIZED_INTEL_ONLY",
    intelligenceValue: "Private-room signals are high risk and should quickly move from victim workflow to official handoff.",
    handoffQuestion: "Is there a threat, invite claim, or room name already shown to the victim that can be recorded without joining?",
  },
  {
    id: "cloud-file-share",
    label: "Cloud/file-share link route",
    routeKind: "FILE_SHARING",
    riskLevel: "HIGH",
    publicDescriptor: "Shared folders, compressed files, expiring file links, mirrors, or paste-like link hubs.",
    safeSignals: ["cloud", "file share", "shared folder", "drive link", "download link", "zip", "mirror", "paste"],
    evidenceToRecord: ["Share page title", "Visible file/folder name", "Uploader alias if visible", "Access request or password prompt", "Report result"],
    doNotDo: ["Do not download the file", "Do not request passwords", "Do not create new mirror links"],
    officialHandoff: ["Platform abuse report", "D4U deletion support", "ECRM if distribution or extortion is suspected"],
    allowedIndicatorSources: ["VICTIM_PROVIDED", "OPEN_WEB_METADATA", "PLATFORM_TRANSPARENCY"],
    accessLevel: "RESTRICTED_CASE_INDICATOR",
    intelligenceValue: "File-share metadata often explains how material moved between public posts and private redistribution.",
    handoffQuestion: "Can the victim provide the visible share page and report outcome without opening or downloading the file?",
  },
  {
    id: "search-cache-archive",
    label: "Search/cache/archive persistence route",
    routeKind: "DISCOVERY_AND_PERSISTENCE",
    riskLevel: "MEDIUM",
    publicDescriptor: "Search snippets, cached results, archived pages, thumbnails, and index remnants after deletion.",
    safeSignals: ["search result", "cache", "cached", "archive", "snippet", "thumbnail", "index", "검색", "캐시"],
    evidenceToRecord: ["Search query used by victim", "Result title/snippet", "Cache/archive indicator", "Original deletion request status"],
    doNotDo: ["Do not open harmful previews repeatedly", "Do not create new archive captures", "Do not share search queries publicly"],
    officialHandoff: ["Search engine removal request", "D4U monitoring/deletion support", "KOCSC/KCSC review when illegal content remains accessible"],
    allowedIndicatorSources: ["VICTIM_PROVIDED", "OPEN_WEB_METADATA", "PLATFORM_TRANSPARENCY"],
    accessLevel: "PUBLIC_GUIDANCE",
    intelligenceValue: "Cache and index remnants explain why harm continues after the original page appears deleted.",
    handoffQuestion: "Is the harm still visible in a result title, snippet, thumbnail, cache, or archive record?",
  },
  {
    id: "p2p-webhard-reupload",
    label: "P2P/webhard/reupload route",
    routeKind: "REUPLOAD_NETWORK",
    riskLevel: "CRITICAL",
    publicDescriptor: "Repeated reposting through file boards, P2P references, webhard-like storage, or torrent-like language.",
    safeSignals: ["p2p", "torrent", "webhard", "reupload", "repost", "mirror", "seed", "magnet"],
    evidenceToRecord: ["Reappearance time", "Changed title or filename", "Visible uploader alias", "Previous takedown history"],
    doNotDo: ["Do not download files", "Do not join sharing groups", "Do not seed, mirror, or verify by accessing the material"],
    officialHandoff: ["D4U repeated-distribution monitoring", "ECRM/police handoff", "KOCSC/KCSC blocking review"],
    allowedIndicatorSources: ["VICTIM_PROVIDED", "OFFICIAL_PUBLIC_NOTICE", "AUTHORIZED_PARTNER_FEED"],
    accessLevel: "AUTHORIZED_INTEL_ONLY",
    intelligenceValue: "Repeated-distribution signals should trigger stronger monitoring and official escalation instead of one-off takedown handling.",
    handoffQuestion: "Did the same material reappear under a changed title, filename, account, or board after deletion?",
  },
  {
    id: "overseas-hosting-cdn",
    label: "Overseas hosting/CDN route",
    routeKind: "INFRASTRUCTURE",
    riskLevel: "HIGH",
    publicDescriptor: "Foreign hosting claims, overseas server notices, CDN mirrors, or platform jurisdiction mismatch.",
    safeSignals: ["overseas", "foreign server", "hosting", "cdn", "mirror domain", "jurisdiction", "offshore"],
    evidenceToRecord: ["Visible host/platform claim", "Domain or platform name in evidence ledger", "Report contact path", "Response or refusal"],
    doNotDo: ["Do not attack the server", "Do not bypass access controls", "Do not publish infrastructure guesses"],
    officialHandoff: ["D4U international cooperation path", "Platform abuse channel", "ECRM/police handoff"],
    allowedIndicatorSources: ["VICTIM_PROVIDED", "OFFICIAL_PUBLIC_NOTICE", "OPEN_WEB_METADATA", "AUTHORIZED_PARTNER_FEED"],
    accessLevel: "RESTRICTED_CASE_INDICATOR",
    intelligenceValue: "Infrastructure route tags help decide whether platform deletion, domestic blocking, or international cooperation is needed.",
    handoffQuestion: "Is there evidence that the host, platform, or operator is outside Korea or refusing local deletion requests?",
  },
  {
    id: "dark-web-onion-claim",
    label: "Dark-web/onion claim route",
    routeKind: "HIGH_RISK_HIDDEN_SERVICE",
    riskLevel: "CRITICAL",
    publicDescriptor: "Claims involving onion addresses, Tor-only services, dark-web markets, or hidden-service mirrors.",
    safeSignals: [".onion", "dark web", "darkweb", "tor", "hidden service", "onion"],
    evidenceToRecord: ["Claim text", "Who reported the claim", "Any already-visible metadata", "Threat/extortion context"],
    doNotDo: ["Do not open onion links", "Do not create accounts", "Do not transact", "Do not collect abuse material"],
    officialHandoff: ["ECRM/police handoff", "D4U urgent consultation", "Specialist legal counsel"],
    allowedIndicatorSources: ["VICTIM_PROVIDED", "AUTHORIZED_PARTNER_FEED", "OFFICIAL_PUBLIC_NOTICE"],
    accessLevel: "AUTHORIZED_INTEL_ONLY",
    intelligenceValue: "Dark-web claims are not a user investigation task; they are priority handoff signals.",
    handoffQuestion: "Was the hidden-service claim shown to the victim, or is it second-hand rumor that needs official verification?",
  },
];

function evidenceText(item: EvidenceItem) {
  return [item.url, item.platform, item.location, item.posterId, item.notes, item.submissionTarget].filter(Boolean).join(" ").toLowerCase();
}

export function detectDigitalCrimeRoutePatterns(evidenceItems: EvidenceItem[]): DigitalCrimeRouteMatch[] {
  return DIGITAL_CRIME_ROUTE_PATTERNS.flatMap((pattern) => {
    const matchedEvidenceIds = evidenceItems
      .filter((item) => {
        const haystack = evidenceText(item);
        const reuploadStatus = pattern.id === "p2p-webhard-reupload" && item.status === "REAPPEARED";
        return reuploadStatus || pattern.safeSignals.some((signal) => haystack.includes(signal.toLowerCase()));
      })
      .map((item) => item.id);

    if (!matchedEvidenceIds.length) {
      return [];
    }

    return [{ ...pattern, matchedEvidenceIds }];
  });
}

export function unsafeOperationalTargetMarkersInRouteKnowledge() {
  const serialized = JSON.stringify(DIGITAL_CRIME_ROUTE_PATTERNS).toLowerCase();
  return ["http://", "https://", "telegram.me/", "discord.gg/", "t.me/"].filter((marker) => serialized.includes(marker));
}
