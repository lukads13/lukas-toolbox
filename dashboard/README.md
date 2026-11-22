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
   - Workers → `toolbox` → Tab **Access** → „Protect this Worker behind Access“,
     Scope **All traffic**, Richtlinie **Cloudflare account** (nur Mitglieder des eigenen Kontos).
   - Rechts unter *Application values* stehen **AUD-Tag** und die **Team-Domain** (`…cloudflareaccess.com`).
     Diese zwei Werte in `wrangler.jsonc` unter `vars` eintragen (eingerichtet am 22.11.2026).

## Lokal ausprobieren

```bash
cd dashboard
npm install
npm test        # Tests
npm run dev     # startet http://localhost:8787 (Tickets brauchen Access, lokal also gesperrt)
```
