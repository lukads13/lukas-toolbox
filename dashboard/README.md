# Toolbox-Dashboard

Eine Webseite auf Cloudflare Workers:
- **Meine Apps:** Kacheln aus [`public/apps.json`](public/apps.json).
- **Tickets:** werden als GitHub Issues im privaten Repo `lukads13/lukas-tickets` gespeichert.
- **Login:** Cloudflare Access. Ohne gültige Anmeldung liefert die API nichts aus.

Kosten: 0 € (Workers Free, Cloudflare Access Free bis 50 Nutzer, GitHub Free).

## Einmalige Einrichtung

1. **Cloudflare-Schlüssel für GitHub** anlegen
   - Cloudflare → *My Profile → API Tokens → Create Token* → Vorlage **„Edit Cloudflare Workers“**.
   - Im GitHub-Repo unter *Settings → Secrets and variables → Actions* zwei Secrets anlegen:
     `CLOUDFLARE_API_TOKEN` (der Schlüssel) und `CLOUDFLARE_ACCOUNT_ID` (steht im Cloudflare-Dashboard rechts).
2. **GitHub-Schlüssel für Tickets** anlegen
   - GitHub → *Settings → Developer settings → Fine-grained tokens → Generate new token*.
   - Repository access: **nur** `lukas-tickets`. Permissions: **Issues: Read and write**.
   - Bei Cloudflare als Secret speichern: Workers → `toolbox` → *Settings → Variables and Secrets*
     → *Add* → Typ **Secret**, Name `GITHUB_TOKEN`.
3. **Login mit Cloudflare Access** einschalten
   - Workers → `toolbox` → *Settings → Domains & Routes* → bei `workers.dev` **Cloudflare Access** aktivieren.
   - Unter *Zero Trust → Access → Applications* die neue App öffnen, eine Regel „Emails = meine Adresse“ setzen.
   - Dort stehen auch **Team-Domain** (z. B. `name.cloudflareaccess.com`) und **AUD-Tag**.
     Diese zwei Werte und die eigene E-Mail in `wrangler.jsonc` unter `vars` eintragen.

## Lokal ausprobieren

```bash
cd dashboard
npm install
npm test        # Tests
npm run dev     # startet http://localhost:8787 (Tickets brauchen Access, lokal also gesperrt)
```
