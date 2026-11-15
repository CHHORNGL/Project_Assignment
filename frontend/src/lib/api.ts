export function base64urlToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function bytesToBase64url(bytes: ArrayBuffer | Uint8Array): string {
  const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < uint8.byteLength; i += 1) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export interface PasskeyLoginParams {
  optionsUrl: string;
  verifyUrl: string;
  fallbackRedirect: string;
  csrfToken?: string;
}

export async function performPasskeyLogin({
  optionsUrl,
  verifyUrl,
  fallbackRedirect,
  csrfToken,
}: PasskeyLoginParams): Promise<string> {
  if (!window.PublicKeyCredential) {
    throw new Error("Passkeys are not supported on this browser or device.");
  }

  const optionsResp = await fetch(optionsUrl, { credentials: "include" });
  if (!optionsResp.ok) {
    throw new Error("Failed to get passkey options.");
  }
  const rawOptions = (await optionsResp.json()) as {
    challenge: string;
    allowCredentials?: Array<{ id: string; type: PublicKeyCredentialType; transports?: AuthenticatorTransport[] }>;
    timeout?: number;
    rpId?: string;
    userVerification?: UserVerificationRequirement;
  };

  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: base64urlToBytes(rawOptions.challenge),
    timeout: rawOptions.timeout,
    rpId: rawOptions.rpId,
    userVerification: rawOptions.userVerification,
    allowCredentials: rawOptions.allowCredentials?.map((cred) => ({
      ...cred,
      id: base64urlToBytes(cred.id),
    })),
  };

  const credential = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
  if (!credential) {
    throw new DOMException("Passkey prompt dismissed", "NotAllowedError");
  }

  const assertion = credential.response as AuthenticatorAssertionResponse;
  const payload = {
    id: credential.id,
    rawId: bytesToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bytesToBase64url(assertion.clientDataJSON),
      authenticatorData: bytesToBase64url(assertion.authenticatorData),
      signature: bytesToBase64url(assertion.signature),
      userHandle: assertion.userHandle ? bytesToBase64url(assertion.userHandle) : null,
    },
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (csrfToken) {
    headers["X-CSRFToken"] = csrfToken;
  }

  const verifyResp = await fetch(verifyUrl, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });

  const verifyResult = (await verifyResp.json().catch(() => ({}))) as {
    status?: string;
    redirect_url?: string;
    message?: string;
  };

  if (verifyResult.status !== "ok") {
    throw new Error(verifyResult.message || "Passkey authentication failed.");
  }

  return verifyResult.redirect_url || fallbackRedirect;
}

export async function postJson<T = Record<string, any>>(
  url: string,
  body: Record<string, unknown>,
  csrfToken?: string,
): Promise<{ ok: boolean; status: number; data: T }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (csrfToken) {
    headers["X-CSRFToken"] = csrfToken;
  }

  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as T;
  return { ok: response.ok, status: response.status, data };
}

export async function performPasskeyRegistration({
  optionsUrl,
  verifyUrl,
  name,
  csrfToken,
}: {
  optionsUrl: string;
  verifyUrl: string;
  name: string;
  csrfToken?: string;
}): Promise<{ status: string; message?: string }> {
  if (!window.PublicKeyCredential) {
    throw new Error("Passkeys are not supported on this browser or device.");
  }

  const optionsResp = await fetch(optionsUrl, { credentials: "include" });
  if (!optionsResp.ok) {
    const errBody = (await optionsResp.json().catch(() => ({}))) as { message?: string };
    throw new Error(errBody.message || "Failed to start passkey registration.");
  }

  const rawOptions = (await optionsResp.json()) as {
    challenge: string;
    rp: PublicKeyCredentialRpEntity;
    user: { id: string; name: string; displayName: string };
    pubKeyCredParams: PublicKeyCredentialParameters[];
    timeout?: number;
    excludeCredentials?: Array<{ id: string; type: PublicKeyCredentialType; transports?: AuthenticatorTransport[] }>;
    authenticatorSelection?: AuthenticatorSelectionCriteria;
    attestation?: AttestationConveyancePreference;
  };

  const publicKey: PublicKeyCredentialCreationOptions = {
    ...rawOptions,
    challenge: base64urlToBytes(rawOptions.challenge),
    user: {
      ...rawOptions.user,
      id: base64urlToBytes(rawOptions.user.id),
    },
    excludeCredentials: rawOptions.excludeCredentials?.map((cred) => ({
      ...cred,
      id: base64urlToBytes(cred.id),
    })),
  };

  const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
  if (!credential) {
    throw new DOMException("Passkey registration dismissed", "NotAllowedError");
  }

  const attResponse = credential.response as AuthenticatorAttestationResponse;
  const payload = {
    name: name.trim() || "Passkey",
    id: credential.id,
    rawId: bytesToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bytesToBase64url(attResponse.clientDataJSON),
      attestationObject: bytesToBase64url(attResponse.attestationObject),
    },
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (csrfToken) headers["X-CSRFToken"] = csrfToken;

  const verifyResp = await fetch(verifyUrl, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });

  const result = (await verifyResp.json().catch(() => ({}))) as {
    status?: string;
    message?: string;
  };
  if (!verifyResp.ok || result.status !== "ok") {
    throw new Error(result.message || "Passkey registration failed.");
  }
  return { status: "ok", message: result.message };
}

export async function requestJson<T = Record<string, any>>(
  url: string,
  method: "GET" | "POST" | "DELETE" | "PUT" = "GET",
  csrfToken?: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: T }> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (csrfToken) headers["X-CSRFToken"] = csrfToken;
  if (body) headers["Content-Type"] = "application/json";

  const response = await fetch(url, {
    method,
    credentials: "include",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as T;
  return { ok: response.ok, status: response.status, data };
}
