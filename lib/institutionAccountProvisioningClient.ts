import type { InstitutionAccountProvisionInput, InstitutionAccountRevocationInput, PublicInstitutionAccountView } from "@/lib/institutionAccountRegistry";

export const INSTITUTION_ACCOUNT_ADMIN_CSRF_HEADER = "x-jium-institution-account-admin";
export const INSTITUTION_ACCOUNT_ADMIN_CSRF_VALUE = "1";

export type InstitutionAccountAdminRequestBody =
  | { action: "LIST" }
  | { action: "PROVISION"; account: InstitutionAccountProvisionInput }
  | { action: "REVOKE"; revocation: InstitutionAccountRevocationInput };

export type InstitutionAccountAdminResponse =
  | {
      ok: true;
      registryVersion?: string;
      updatedAt?: string;
      accounts?: PublicInstitutionAccountView[];
      account?: PublicInstitutionAccountView;
    }
  | {
      ok: false;
      errorCode: string;
      message?: string;
    };

export function institutionAccountAdminHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    [INSTITUTION_ACCOUNT_ADMIN_CSRF_HEADER]: INSTITUTION_ACCOUNT_ADMIN_CSRF_VALUE,
  };
}
