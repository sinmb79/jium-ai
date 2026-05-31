import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrustedKeyApprovalPanel } from "@/components/TrustedKeyApprovalPanel";
import type { TrustedAuthorizedFeedKey } from "@/lib/authorizedFeedSignature";

const validKey: TrustedAuthorizedFeedKey = {
  keyId: "partner-key-ui-2026-06",
  issuerName: "Authorized Partner",
  algorithm: "RSASSA-PKCS1-v1_5",
  publicKeyJwk: {
    kty: "RSA",
    n: "public-modulus-for-ui-approval",
    e: "AQAB",
    use: "sig",
  },
  validFrom: "2026-06-01T00:00:00.000Z",
  validUntil: "2027-06-01T00:00:00.000Z",
};

describe("TrustedKeyApprovalPanel", () => {
  it("reviews a candidate key and renders a registry patch", async () => {
    render(<TrustedKeyApprovalPanel trustedFeedKeys={[]} />);

    fireEvent.change(screen.getByPlaceholderText(/partner-key-2026-06/), {
      target: { value: JSON.stringify(validKey) },
    });
    fireEvent.click(screen.getByText("공개키 검토"));

    await waitFor(() => expect(screen.getByText("승인 검토 가능")).toBeInTheDocument());
    expect(screen.getByText(/fingerprint sha256-/)).toBeInTheDocument();
    expect(screen.getByText(/registry 반영 뒤 npm run security:server-readiness/)).toBeInTheDocument();
    expect(screen.getAllByDisplayValue(/partner-key-ui-2026-06/).length).toBeGreaterThanOrEqual(1);
  });

  it("blocks private JWK material", async () => {
    render(<TrustedKeyApprovalPanel trustedFeedKeys={[]} />);

    fireEvent.change(screen.getByPlaceholderText(/partner-key-2026-06/), {
      target: {
        value: JSON.stringify({
          ...validKey,
          algorithm: "RSASSA-PKCS1-v1_5",
          publicKeyJwk: { ...validKey.publicKeyJwk, d: "private-exponent" },
        }),
      },
    });
    fireEvent.click(screen.getByText("공개키 검토"));

    await waitFor(() => expect(screen.getByText("등록 차단")).toBeInTheDocument());
    expect(screen.getByText(/private JWK field: d/)).toBeInTheDocument();
  });
});
