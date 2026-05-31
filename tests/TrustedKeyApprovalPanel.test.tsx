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

  it("reviews registry lifecycle and generates a retirement patch", async () => {
    render(<TrustedKeyApprovalPanel trustedFeedKeys={[]} />);

    fireEvent.change(screen.getByPlaceholderText(/trusted-keys-v1/), {
      target: {
        value: JSON.stringify({
          version: "jium-authorized-feed-trusted-keys-v1",
          keys: [
            {
              ...validKey,
              keyId: "partner-key-retire-ui",
              algorithm: "RSASSA-PKCS1-v1_5",
              validFrom: "2026-01-01T00:00:00.000Z",
            },
          ],
        }),
      },
    });
    fireEvent.click(screen.getByText("registry 수명주기 검토"));
    await waitFor(() => expect(screen.getByText("활성 1개")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("partner-key-..."), {
      target: { value: "partner-key-retire-ui" },
    });
    fireEvent.change(screen.getByPlaceholderText("2026-06-02T00:00:00.000Z"), {
      target: { value: "2026-06-02T00:00:00.000Z" },
    });
    fireEvent.click(screen.getByText("폐기 patch 생성"));

    await waitFor(() => expect(screen.getByText(/폐기 patch를 만들었습니다/)).toBeInTheDocument());
    expect(screen.getByText("폐기 patch 저장")).not.toBeDisabled();
  });
});
