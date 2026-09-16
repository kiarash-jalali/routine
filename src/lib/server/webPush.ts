import { createPrivateKey, sign } from "node:crypto";

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

function encodeBase64Url(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function createVapidJwt(endpoint: string) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error("VAPID is not configured.");
  }

  const publicBytes = decodeBase64Url(publicKey);
  const privateBytes = decodeBase64Url(privateKey);

  if (publicBytes.length !== 65 || publicBytes[0] !== 4) {
    throw new Error("VAPID public key must be an uncompressed P-256 key.");
  }
  if (privateBytes.length !== 32) {
    throw new Error("VAPID private key must be 32 bytes.");
  }

  const x = publicBytes.subarray(1, 33).toString("base64url");
  const y = publicBytes.subarray(33, 65).toString("base64url");
  const d = privateBytes.toString("base64url");
  const key = createPrivateKey({
    key: { kty: "EC", crv: "P-256", x, y, d },
    format: "jwk",
  });

  const header = encodeBase64Url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = encodeBase64Url(
    JSON.stringify({
      aud: new URL(endpoint).origin,
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
      sub: subject,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signature = sign("sha256", Buffer.from(unsigned), {
    key,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");

  return { token: `${unsigned}.${signature}`, publicKey };
}

export async function sendEmptyPush(endpoint: string) {
  const { token, publicKey } = createVapidJwt(endpoint);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${token}, k=${publicKey}`,
      TTL: "300",
      Urgency: "normal",
    },
  });

  return response.status;
}
