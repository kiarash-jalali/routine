import { createECDH, randomBytes } from "node:crypto";

const ecdh = createECDH("prime256v1");
ecdh.generateKeys();

const publicKey = ecdh.getPublicKey().toString("base64url");
const privateKey = ecdh.getPrivateKey().toString("base64url");
const cronSecret = randomBytes(32).toString("base64url");

console.log("NEXT_PUBLIC_VAPID_PUBLIC_KEY=" + publicKey);
console.log("VAPID_PRIVATE_KEY=" + privateKey);
console.log("VAPID_SUBJECT=mailto:you@example.com");
console.log("NOTIFICATION_CRON_SECRET=" + cronSecret);
