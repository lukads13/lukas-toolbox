// Frontend des Toolbox-Dashboards (ohne Framework, ohne Build-Schritt).

const $ = (sel) => document.querySelector(sel);
let allTickets = [];
let appsById = {};

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

async function loadApps() {
  const apps = await fetch("apps.json").then((r) => r.json());
  const grid = $("#apps");
  const select = $("#app-select");
  for (const app of apps) {
    appsById[app.id] = app;
    const links = el("div", { class: "links" });
    if (app.url) links.append(el("a", { href: app.url }, "Öffnen"));
    if (app.repo) links.append(el("a", { href: app.repo, target: "_blank", rel: "noopener" }, "Code"));
    grid.append(
      el("article", { class: "card app" },
        el("div", { class: "icon" }, app.icon || "📦"),
        el("h3", {}, app.name),
        el("p", {}, app.description || ""),
        el("span", { class: "pill" }, app.status || ""),
        links,
      ),
    );
    select.append(el("option", { value: app.id }, app.name));
  }
}

async function loadTickets() {
  const list = $("#tickets");
  const res = await fetch("/api/tickets");
  if (res.status === 401) {
    list.replaceChildren(el("li", { class: "muted" }, "Nicht angemeldet. Die Anmeldung über Cloudflare Access ist noch nicht eingerichtet."));
    $("#ticket-form button").disabled = true;
    return;
  }
  if (!res.ok) {
    list.replaceChildren(el("li", { class: "muted" }, "Tickets konnten nicht geladen werden."));
    return;
  }
  allTickets = await res.json();
  renderTickets();
}

function renderTickets() {
  const filter = $("#filter").value;
  const shown = allTickets.filter((t) =>
    filter === "alle" ? true : filter === "erledigt" ? t.status === "erledigt" : t.status !== "erledigt",
  );
  const list = $("#tickets");
  if (shown.length === 0) {
    list.replaceChildren(el("li", { class: "muted" }, "Keine Tickets."));
    return;
  }
  list.replaceChildren(
    ...shown.map((t) =>
      el("li", { class: "card ticket" },
        el("div", {},
          el("a", { href: t.url, target: "_blank", rel: "noopener" }, `#${t.number} ${t.title}`),
          el("div", { class: "pill" },
            [t.app ? appsById[t.app]?.name || t.app : null,
             t.comments ? `${t.comments} Kommentar${t.comments === 1 ? "" : "e"}` : null,
             new Date(t.updated).toLocaleDateString("de-DE")].filter(Boolean).join(" · "),
          ),
        ),
        el("span", { class: `badge ${t.status.replace(" ", "-").toLowerCase()}` }, t.status),
      ),
    ),
  );
}

async function loadMe() {
  const res = await fetch("/api/me");
  if (res.ok) $("#me").textContent = (await res.json()).email;
}

$("#ticket-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const button = form.querySelector("button");
  const msg = $("#form-msg");
  button.disabled = true;
  msg.textContent = "Wird angelegt …";
  try {
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Fehler");
    msg.textContent = `Ticket #${data.number} angelegt. Sag Claude: „Bearbeite Ticket #${data.number}“.`;
    form.reset();
    await loadTickets();
  } catch (err) {
    msg.textContent = `Hat nicht geklappt: ${err.message}`;
  } finally {
    button.disabled = false;
  }
});

$("#filter").addEventListener("change", renderTickets);

loadApps().then(loadTickets);
loadMe();
