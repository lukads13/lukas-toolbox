# lukas-toolbox

Lukas schreibt Deutsch und ist Einsteiger: Antworten auf Deutsch, einfach, kurze Schritte.

## Aufbau
- `dashboard/`: Cloudflare Worker mit dem Toolbox-Dashboard (App-Liste + Tickets).
  - `public/apps.json`: Liste aller Apps. Neue App = neuer Eintrag hier.
  - `src/index.js`: API (`/api/tickets`, `/api/me`), prüft das Cloudflare-Access-Token.
  - Tests: `cd dashboard && npm test`.
- Deployment: GitHub Action `.github/workflows/deploy-dashboard.yml` bei jedem Push auf `main`.

## Tickets bearbeiten
Tickets sind GitHub Issues im **privaten** Repo `lukads13/lukas-tickets`.
1. Ticket lesen. Das Label `app:<id>` sagt, welche App gemeint ist (siehe `apps.json`).
2. Label `in-arbeit` setzen, im Ticket kurz kommentieren, was geplant ist.
3. Im passenden App-Repo einen Branch und Pull Request anlegen. Im PR auf das Ticket
   verlinken (`lukads13/lukas-tickets#<nr>`). Keine Ticket-Inhalte in öffentliche Repos
   kopieren, nur eine kurze Beschreibung der Änderung.
4. Wenn der PR gemergt ist: Ticket mit Kommentar schließen, Label `in-arbeit` entfernen.

## Regeln
- Dieses Repo ist öffentlich: niemals Tokens, Passwörter oder `.dev.vars` committen.
  Geheimnisse gehören in `npx wrangler secret put` oder in GitHub Secrets.
