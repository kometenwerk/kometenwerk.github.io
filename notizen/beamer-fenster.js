// FIDELIA Notizen · Beamer-Fenster: zeigt nur die Folie. Gesteuert über BroadcastChannel aus der Referentenansicht.
import * as K from "./folien-kern.js";

const kanal = new BroadcastChannel("fidelia-beamer"), id = decodeURIComponent(location.hash.slice(1));
const buehne = document.getElementById("buehne"), laser = document.getElementById("laser"), hinweis = document.getElementById("hinweis");
let daten = null, stand = { fi: 0, schritt: 0 }, katexBereit = false;
const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const katex = (tex) => { try { return katexBereit && window.katex ? window.katex.renderToString(tex, { throwOnError: false }) : esc(tex); } catch (e) { return esc(tex); } };
function groesse() { const k = Math.min(innerWidth / K.W, innerHeight / K.H); buehne.style.transform = "translate(" + (innerWidth - K.W * k) / 2 + "px," + (innerHeight - K.H * k) / 2 + "px) scale(" + k + ")"; }
function zeigen(neu, uebergang) {
  if (!daten) return;
  document.getElementById("warte").hidden = true;
  if (stand.fi >= daten.folien.length) { buehne.innerHTML = '<div class="folie v-ende"><p>Ende der Präsentation</p></div>'; return; }
  const f = daten.folien[stand.fi];
  buehne.innerHTML = K.folieHtml(f, daten.design, { schritt: stand.schritt, neu, katex });
  const el = buehne.querySelector(".folie"); if (uebergang && f.ueber && el) el.classList.add("ueber-" + f.ueber);
}
kanal.onmessage = (e) => {
  const m = e.data || {}; if (m.id !== id) return;
  if (m.typ === "daten") { daten = m.daten; stand = m.stand; zeigen(false, false); if (JSON.stringify(daten).includes('"tex"') && !window.katex) katexLaden(); }
  else if (m.typ === "stand") { const alt = stand; stand = m.stand; zeigen(stand.fi === alt.fi && stand.schritt > alt.schritt, stand.fi !== alt.fi); }
  else if (m.typ === "schwarz") document.getElementById("schwarz").hidden = !m.an;
  else if (m.typ === "laser") { laser.hidden = !m.an; if (m.an) { const k = Math.min(innerWidth / K.W, innerHeight / K.H); laser.style.left = (innerWidth - K.W * k) / 2 + m.x * K.W * k + "px"; laser.style.top = (innerHeight - K.H * k) / 2 + m.y * K.H * k + "px"; } }
  else if (m.typ === "ende") window.close();
};
function katexLaden() {
  const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "../shared/vendor/katex-0.16.47/katex.min.css"; document.head.appendChild(l);
  const sk = document.createElement("script"); sk.src = "../shared/vendor/katex-0.16.47/katex.min.js"; sk.onload = () => { katexBereit = true; zeigen(false, false); }; document.head.appendChild(sk);
}
const vollbild = () => { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); hinweis.hidden = true; };
hinweis.onclick = vollbild; hinweis.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") vollbild(); };
document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement) hinweis.hidden = false; });
// Tasten im Beamer-Fenster weiterreichen (falls jemand dort klickt)
document.addEventListener("keydown", (e) => { if (["ArrowRight", "ArrowLeft", " ", "PageDown", "PageUp"].includes(e.key)) { e.preventDefault(); kanal.postMessage({ id, typ: "taste", taste: e.key }); } });
addEventListener("resize", groesse); groesse();
kanal.postMessage({ id, typ: "hallo" });
addEventListener("beforeunload", () => kanal.postMessage({ id, typ: "zu" }));
