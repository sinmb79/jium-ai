import {
  createInstitutionServerRouteHandlers,
  loadInstitutionServerRouteConfig,
  type InstitutionServerRouteHandlers,
} from "@/lib/institutionServerRoutes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let cachedRoutes: InstitutionServerRouteHandlers | undefined;

function institutionRoutes() {
  cachedRoutes ||= createInstitutionServerRouteHandlers(loadInstitutionServerRouteConfig());
  return cachedRoutes;
}

export async function GET(request: Request) {
  return institutionRoutes().session(request);
}
