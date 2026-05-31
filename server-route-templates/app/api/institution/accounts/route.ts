import {
  createInstitutionServerRouteHandlers,
  loadInstitutionServerRouteConfig,
  type InstitutionServerRouteHandlers,
} from "@/lib/institutionServerRoutes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

let cachedRoutes: InstitutionServerRouteHandlers | undefined;

function institutionRoutes() {
  cachedRoutes ||= createInstitutionServerRouteHandlers(loadInstitutionServerRouteConfig());
  return cachedRoutes;
}

export async function POST(request: Request) {
  return institutionRoutes().accounts(request);
}
