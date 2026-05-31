export type EncryptedJsonPayload = {
  version: 1;
  algorithm: "AES-GCM";
  kdf: "PBKDF2-SHA-256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
};

const DEFAULT_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function ensureBrowserCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto API is not available in this environment");
  }
  return globalThis.crypto;
}

function toBufferSource(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array, iterations: number) {
  if (passphrase.length < 12) {
    throw new Error("Passphrase must be at least 12 characters");
  }

  const crypto = ensureBrowserCrypto();
  const encoded = new TextEncoder().encode(passphrase);
  const material = await crypto.subtle.importKey("raw", encoded, "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toBufferSource(salt),
      iterations,
    },
    material,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptJsonWithPassphrase(value: unknown, passphrase: string, iterations = DEFAULT_ITERATIONS): Promise<EncryptedJsonPayload> {
  const crypto = ensureBrowserCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveAesKey(passphrase, salt, iterations);
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toBufferSource(iv) }, key, toBufferSource(plaintext));

  return {
    version: 1,
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA-256",
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptJsonWithPassphrase<T>(payload: EncryptedJsonPayload, passphrase: string): Promise<T> {
  if (payload.version !== 1 || payload.algorithm !== "AES-GCM" || payload.kdf !== "PBKDF2-SHA-256") {
    throw new Error("Unsupported encrypted payload");
  }

  const key = await deriveAesKey(passphrase, base64ToBytes(payload.salt), payload.iterations);
  const decrypted = await ensureBrowserCrypto().subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toBufferSource(base64ToBytes(payload.iv)),
    },
    key,
    toBufferSource(base64ToBytes(payload.ciphertext)),
  );
  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}

export function isEncryptedJsonPayload(value: unknown): value is EncryptedJsonPayload {
  const payload = value as Partial<EncryptedJsonPayload>;
  return payload?.version === 1 && payload.algorithm === "AES-GCM" && payload.kdf === "PBKDF2-SHA-256" && Boolean(payload.salt && payload.iv && payload.ciphertext);
}
