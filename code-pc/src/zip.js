// Kometenwerk Code · kleines ZIP ohne Komprimierung (reicht für Code, Tabellen und Zeichnungen)
const TAB = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = TAB[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

// dateien: [{ name: "ordner/datei.txt", inhalt: string | Uint8Array }] → Uint8Array
export function zip(dateien, datum = new Date()) {
  const enc = new TextEncoder(), teile = [], zentral = [];
  const zeit = (datum.getHours() << 11) | (datum.getMinutes() << 5) | (datum.getSeconds() >> 1);
  const tag = ((datum.getFullYear() - 1980) << 9) | ((datum.getMonth() + 1) << 5) | datum.getDate();
  let pos = 0;
  for (const d of dateien) {
    const name = enc.encode(d.name), daten = typeof d.inhalt === "string" ? enc.encode(d.inhalt) : d.inhalt, crc = crc32(daten);
    const kopf = new DataView(new ArrayBuffer(30));
    kopf.setUint32(0, 0x04034b50, true); kopf.setUint16(4, 20, true); kopf.setUint16(6, 0x0800, true); kopf.setUint16(8, 0, true);
    kopf.setUint16(10, zeit, true); kopf.setUint16(12, tag, true); kopf.setUint32(14, crc, true);
    kopf.setUint32(18, daten.length, true); kopf.setUint32(22, daten.length, true); kopf.setUint16(26, name.length, true); kopf.setUint16(28, 0, true);
    teile.push(new Uint8Array(kopf.buffer), name, daten);
    const z = new DataView(new ArrayBuffer(46));
    z.setUint32(0, 0x02014b50, true); z.setUint16(4, 20, true); z.setUint16(6, 20, true); z.setUint16(8, 0x0800, true); z.setUint16(10, 0, true);
    z.setUint16(12, zeit, true); z.setUint16(14, tag, true); z.setUint32(16, crc, true); z.setUint32(20, daten.length, true); z.setUint32(24, daten.length, true);
    z.setUint16(28, name.length, true); z.setUint32(42, pos, true);
    zentral.push(new Uint8Array(z.buffer), name);
    pos += 30 + name.length + daten.length;
  }
  const zgr = zentral.reduce((s, x) => s + x.length, 0), ende = new DataView(new ArrayBuffer(22));
  ende.setUint32(0, 0x06054b50, true); ende.setUint16(8, dateien.length, true); ende.setUint16(10, dateien.length, true); ende.setUint32(12, zgr, true); ende.setUint32(16, pos, true);
  const alle = [...teile, ...zentral, new Uint8Array(ende.buffer)], aus = new Uint8Array(alle.reduce((s, x) => s + x.length, 0));
  let o = 0; for (const x of alle) { aus.set(x, o); o += x.length; }
  return aus;
}
export function base64(bytes) { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
