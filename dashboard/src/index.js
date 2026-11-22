// Toolbox-Dashboard: liefert die Webseite aus (public/) und eine kleine API
// für Tickets. Tickets sind GitHub Issues im privaten Repo TICKETS_REPO.
//
// Sicherheit:
// - Jede API-Anfrage muss ein gültiges Cloudflare-Access-Token tragen
//   (Header Cf-Access-Jwt-Assertion). Die Signatur wird hier geprüft.
// - Ist Access noch nicht eingerichtet, antwortet die API mit 401.
// - Der GitHub-Schlüssel (GITHUB_TOKEN) ist ein Cloudflare-Secret und
//   verlässt den Worker nie.

const STATUS_LABEL = "in-arbeit";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }
    try {
      const email = await authenticate(request, env);
      if (!email) return json({ error: "Nicht angemeldet." }, 401);

      if (url.pathname === "/api/me" && request.method === "GET") {
        return json({ email });
      }
      if (url.pathname === "/api/tickets" && request.method === "GET") {
        return json(await listTickets(env));
      }
      if (url.pathname === "/api/tickets" && request.method === "POST") {
        return await createTicket(request, env, email);
      }
      return json({ error: "Nicht gefunden." }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: friendlyError(err) }, 500);
    }
  },
};

// ---------- Tickets (GitHub Issues) ----------

async function listTickets(env) {
  const issues = await github(
    env,
    `/repos/${env.TICKETS_REPO}/issues?state=all&per_page=50&sort=updated`,
  );
  return issues
    .filter((i) => !i.pull_request)
    .map((i) => {
      const labels = i.labels.map((l) => (typeof l === "string" ? l : l.name));
      const appLabel = labels.find((l) => l.startsWith("app:"));
      let status = "offen";
      if (i.state === "closed") status = "erledigt";
      else if (labels.includes(STATUS_LABEL)) status = "in Arbeit";
      return {
        number: i.number,
        title: i.title,
        app: appLabel ? appLabel.slice(4) : null,
        status,
        comments: i.comments,
        url: i.html_url,
        updated: i.updated_at,
      };
    });
}

async function createTicket(request, env, email) {
  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: "Ungültige Anfrage." }, 400);
  }
  const title = String(data.title || "").trim().slice(0, 200);
  const details = String(data.details || "").trim().slice(0, 10000);
  const app = String(data.app || "").trim();
  if (!title) return json({ error: "Bitte einen Titel angeben." }, 400);
  if (app && !/^[a-z0-9-]{1,50}$/.test(app)) {
    return json({ error: "Unbekannte App." }, 400);
  }

  const body = [
    details || "_Keine Details angegeben._",
    "",
    "---",
    `App: ${app || "keine bestimmte"}`,
    `Erstellt über das Toolbox-Dashboard von ${email}`,
  ].join("\n");

  const issue = await github(env, `/repos/${env.TICKETS_REPO}/issues`, {
    method: "POST",
    body: JSON.stringify({
      title,
      body,
      labels: app ? [`app:${app}`] : [],
    }),
  });
  return json({ number: issue.number, url: issue.html_url }, 201);
}

async function github(env, path, init = {}) {
  if (!env.GITHUB_TOKEN) throw new GitHubError(0, "GITHUB_TOKEN ist nicht gesetzt.");
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "toolbox-dashboard",
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new GitHubError(res.status, await res.text());
  }
  return res.json();
}

class GitHubError extends Error {
  constructor(status, detail) {
    super(`GitHub ${status}: ${detail}`);
    this.status = status;
  }
}

// Verständliche Meldung für die Webseite, ohne geheime Details.
export function friendlyError(err) {
  if (!(err instanceof GitHubError)) return "Interner Fehler. Details stehen im Cloudflare-Log.";
  switch (err.status) {
    case 0:
      return "Der GitHub-Schlüssel fehlt: Secret GITHUB_TOKEN beim Worker anlegen.";
    case 401:
      return "GitHub lehnt den Schlüssel ab (ungültig oder abgelaufen). Bitte neuen GITHUB_TOKEN anlegen.";
    case 403:
      return "Der GitHub-Schlüssel darf das nicht. Er braucht „Issues: Read and write“ für lukas-tickets.";
    case 404:
      return "GitHub findet das Ticket-Repo nicht. Der Schlüssel muss Zugriff auf lukas-tickets haben.";
    default:
      return `GitHub-Fehler ${err.status}. Details stehen im Cloudflare-Log.`;
  }
}

// ---------- Cloudflare Access ----------

let certCache = { at: 0, keys: [] };

export async function authenticate(request, env) {
  const team = env.ACCESS_TEAM_DOMAIN;
  const aud = env.ACCESS_AUD;
  if (!team || !aud) return null; // Access noch nicht eingerichtet: alles sperren.

  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  let header, payload;
  try {
    header = JSON.parse(b64urlToString(parts[0]));
    payload = JSON.parse(b64urlToString(parts[1]));
  } catch {
    return null;
  }
  if (header.alg !== "RS256") return null;

  const jwk = await findKey(team, header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!ok) return null;

  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(aud)) return null;
  if (payload.iss !== `https://${team}`) return null;
  if (typeof payload.exp !== "number" || payload.exp < now) return null;
  if (typeof payload.nbf === "number" && payload.nbf > now + 60) return null;

  const email = String(payload.email || "").toLowerCase();
  const allowed = String(env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  // Wer rein darf, regelt die Access-Richtlinie bei Cloudflare. ALLOWED_EMAILS ist
  // eine optionale zweite Liste (z. B. als Secret), leer = jede von Access geprüfte Person.
  if (!email) return null;
  if (allowed.length > 0 && !allowed.includes(email)) return null;
  return email;
}

async function findKey(team, kid) {
  const fresh = Date.now() - certCache.at < 10 * 60 * 1000;
  let key = fresh && certCache.keys.find((k) => k.kid === kid);
  if (key) return key;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) return null;
  const { keys = [] } = await res.json();
  certCache = { at: Date.now(), keys };
  return keys.find((k) => k.kid === kid) || null;
}

function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function b64urlToString(s) {
  return new TextDecoder().decode(b64urlToBytes(s));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
