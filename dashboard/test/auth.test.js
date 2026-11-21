// Prüft die Cloudflare-Access-Anmeldung mit selbst erzeugten Test-Schlüsseln.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { authenticate } from "../src/index.js";

const TEAM = "beispiel.cloudflareaccess.com";
const AUD = "test-aud";
const env = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ALLOWED_EMAILS: "ich@example.com" };
let keys, otherKeys, publicJwk;

const b64url = (bytes) => Buffer.from(bytes).toString("base64url");

async function makeToken(payload, privateKey = keys.privateKey, kid = "k1") {
  const head = b64url(JSON.stringify({ alg: "RS256", kid }));
  const body = b64url(JSON.stringify(payload));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(new Uint8Array(sig))}`;
}

const req = (token) => new Request("https://toolbox.example/api/me", token ? { headers: { "Cf-Access-Jwt-Assertion": token } } : {});
const now = () => Math.floor(Date.now() / 1000);
const good = () => ({ aud: [AUD], iss: `https://${TEAM}`, exp: now() + 600, email: "ich@example.com" });

before(async () => {
  const alg = { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" };
  keys = await crypto.subtle.generateKey(alg, true, ["sign", "verify"]);
  otherKeys = await crypto.subtle.generateKey(alg, true, ["sign", "verify"]);
  publicJwk = { ...(await crypto.subtle.exportKey("jwk", keys.publicKey)), kid: "k1" };
  globalThis.fetch = async (url) => {
    assert.equal(url, `https://${TEAM}/cdn-cgi/access/certs`);
    return new Response(JSON.stringify({ keys: [publicJwk] }));
  };
});

test("gültiges Token wird akzeptiert", async () => {
  assert.equal(await authenticate(req(await makeToken(good())), env), "ich@example.com");
});

test("ohne Token: gesperrt", async () => {
  assert.equal(await authenticate(req(), env), null);
});

test("Access nicht eingerichtet: gesperrt", async () => {
  const t = await makeToken(good());
  assert.equal(await authenticate(req(t), { ...env, ACCESS_AUD: "" }), null);
});

test("falsche Signatur: gesperrt", async () => {
  assert.equal(await authenticate(req(await makeToken(good(), otherKeys.privateKey)), env), null);
});

test("abgelaufen: gesperrt", async () => {
  assert.equal(await authenticate(req(await makeToken({ ...good(), exp: now() - 10 })), env), null);
});

test("falsche Audience: gesperrt", async () => {
  assert.equal(await authenticate(req(await makeToken({ ...good(), aud: ["andere"] })), env), null);
});

test("fremde E-Mail: gesperrt", async () => {
  assert.equal(await authenticate(req(await makeToken({ ...good(), email: "fremd@example.com" })), env), null);
});

test("keine erlaubten E-Mails eingetragen: gesperrt", async () => {
  assert.equal(await authenticate(req(await makeToken(good())), { ...env, ALLOWED_EMAILS: "" }), null);
});
