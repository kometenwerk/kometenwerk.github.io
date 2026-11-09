// FIDELIA Notizen · Speicher auf dem Gerät (IndexedDB)
// Heftseiten, Scans und Lernkarten werden groß – darum nicht im kleinen localStorage, sondern in IndexedDB.
// Nichts davon verlässt das Gerät.

// ?demo=1&geraet=b → eigener Speicher pro „Gerät“ (nur zum Testen des Abgleichs in zwei Tabs)
const NAME = "fidelia-notizen" + (typeof location !== "undefined" && /[?&]demo=1\b/.test(location.search) ? "-" + (new URLSearchParams(location.search).get("geraet") || "a") : "");
let dbVersprechen = null;

function db() {
  if (!dbVersprechen) dbVersprechen = new Promise((ok, nein) => {
    const r = indexedDB.open(NAME, 2);
    r.onupgradeneeded = (e) => {
      const d = r.result;
      if (e.oldVersion < 1) {
        d.createObjectStore("seiten", { keyPath: "id" });
        d.createObjectStore("bilder");
        d.createObjectStore("lern", { keyPath: "id" });
      }
      // Ältere Versionen von Seiten, Tabellen, Präsentationen (bleiben nur auf diesem Gerät)
      if (e.oldVersion < 2) d.createObjectStore("versionen", { keyPath: "id" });
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => { dbVersprechen = null; nein(r.error); };
  });
  return dbVersprechen;
}

async function mit(store, modus, arbeit) {
  const d = await db();
  return new Promise((ok, nein) => {
    const t = d.transaction(store, modus);
    const anfrage = arbeit(t.objectStore(store));
    t.oncomplete = () => ok(anfrage ? anfrage.result : undefined);
    t.onerror = () => nein(t.error);
    t.onabort = () => nein(t.error || new Error("abgebrochen"));
  });
}

export const alle = (store) => mit(store, "readonly", s => s.getAll());
export const hole = (store, key) => mit(store, "readonly", s => s.get(key));
export const lege = (store, wert, key) => mit(store, "readwrite", s => key === undefined ? s.put(wert) : s.put(wert, key));
export const weg = (store, key) => mit(store, "readwrite", s => s.delete(key));
export const leeren = (store) => mit(store, "readwrite", s => s.clear());
export const schluessel = (store) => mit(store, "readonly", s => s.getAllKeys());

// Browser bitten, die Daten nicht automatisch zu löschen
export async function dauerhaft() {
  try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) {}
  return false;
}

export async function platz() {
  try { if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate(); } catch (e) {}
  return null;
}
