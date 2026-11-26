// Kometenwerk Code · Zeichner für Schaltplan, Flussdiagramm und technische Zeichnung (Bauplan)
// Du zeichnest selbst. Das Programm hilft beim Ausrichten (Raster, Einrasten), beim Bemaßen und bei Lochmustern
// und prüft beim Schaltplan, ob die Pins aus deinem Code auch im Plan verbunden sind.
import { brettLayout, brettSvg } from "./bretter.js";

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const r2 = (v) => Math.round(v * 100) / 100;
const zahlDe = (v) => String(r2(v)).replace(".", ",");
// Einheit der technischen Zeichnung: gespeichert wird immer in mm, angezeigt/eingegeben in mm oder cm
let EINH = "mm";
const einhF = () => EINH === "cm" ? 10 : 1;
const masszahl = (mm) => zahlDe(mm / einhF());
export function laengeLesen(t) {   // "12,5" / "12.5 cm" / "120 mm" / "0,3 m" → mm (NaN wenn ungültig)
  const m = /^\s*(-?\d+(?:[.,]\d+)?|-?[.,]\d+)\s*(mm|cm|m)?\s*$/i.exec(String(t)); if (!m) return NaN;
  const v = Number(m[1].replace(",", ".")), e = (m[2] || EINH).toLowerCase();
  return r2(v * (e === "cm" ? 10 : e === "m" ? 1000 : 1));
}
let idZaehler = Date.now() % 100000;
const neueId = () => "e" + (idZaehler++).toString(36);

/* ================= Symbole ================= */
const UNO_L = ["5V", "3.3V", "GND", "GND", "Vin", "A0", "A1", "A2", "A3", "A4", "A5"];
const UNO_R = ["D13", "D12", "~D11", "~D10", "~D9", "D8", "D7", "~D6", "~D5", "D4", "~D3", "D2", "D1", "D0"];
const UNO_ALT_PINS = [...UNO_L.map((n, i) => [0, 20 + i * 20, n]), ...UNO_R.map((n, i) => [140, 20 + i * 20, n.replace("~", "")])];
const brettPins = (e) => brettLayout(SYM[e.typ].brett, e.ansicht).pins.map(([x, y, n]) => [x, y, n]);
// Maße eines Boards je nach Ansicht (werden im Teil gespeichert, damit Drehen und Auswählen stimmen)
function brettMasse(e) { if (e.typ === "arduino" && !e.v) return { w: 140, h: 300 }; const L = brettLayout(SYM[e.typ].brett, e.ansicht); return { w: L.w, h: L.h }; }
export const BRETTER = new Set(["arduino", "nano", "mega"]);
const brettFelder = (e) => [["text", "Beschriftung"], ["ansicht", "Ansicht", "wahl", [...(e.typ === "arduino" && !e.v ? [["alt", "Schaltzeichen (alte Form)"]] : []), ["symbol", "Schaltzeichen mit allen Pins"], ["echt", "Wie das echte Board"]]]];
const modulPins = (liste, unten, gr = 8) => liste.map(([n, x]) => '<path d="M' + x + " " + unten + "v20" + '"/>' + T(x, unten - 4, n, 'font-size="' + gr + '" text-anchor="middle"')).join("");
const T = (x, y, t, o = "") => '<text x="' + x + '" y="' + y + '" ' + o + ">" + esc(t) + "</text>";
const mehrzeilig = (x, y, t, gr = 13) => { const z = String(t || "").split("\n"); return z.map((l, i) => T(x, y + (i - (z.length - 1) / 2) * gr * 1.2 + gr * 0.35, l, 'text-anchor="middle" font-size="' + gr + '"')).join(""); };

export const SYM = {
  /* ---- Schaltplan (Einheit: Raster 10) ---- */
  arduino: { modus: "schaltplan", name: "Arduino Uno", brett: "uno", w: 140, h: 300,
    pins: (e) => e.v ? brettPins(e) : UNO_ALT_PINS,
    svg: (e) => e.v ? brettSvg("uno", e.ansicht, e.text) : '<rect x="20" y="0" width="100" height="300" rx="4" class="dick"/>' + UNO_L.map((n, i) => '<path d="M0 ' + (20 + i * 20) + 'h20"/>' + T(24, 24 + i * 20, n, 'font-size="10"')).join("") +
      UNO_R.map((n, i) => '<path d="M120 ' + (20 + i * 20) + 'h20"/>' + T(116, 24 + i * 20, n, 'font-size="10" text-anchor="end"')).join("") + T(70, 292, e.text || "Arduino Uno", 'font-size="11" text-anchor="middle" font-weight="600"'),
    felder: brettFelder },
  nano: { modus: "schaltplan", name: "Arduino Nano", brett: "nano", w: 140, h: 380, pins: (e) => brettPins(e), svg: (e) => brettSvg("nano", e.ansicht, e.text), felder: brettFelder },
  mega: { modus: "schaltplan", name: "Arduino Mega", brett: "mega", w: 180, h: 980, pins: (e) => brettPins(e), svg: (e) => brettSvg("mega", e.ansicht, e.text), felder: brettFelder },
  usb: { modus: "schaltplan", name: "PC / Laptop (USB-Kabel)", w: 80, h: 60, pins: [[80, 20, "USB"]],
    svg: (e) => '<rect x="4" y="0" width="48" height="34" rx="2"/><rect x="9" y="5" width="38" height="24" style="stroke-width:1"/><path d="M0 40h56l-4 6H4z"/><path d="M56 20h24"/><rect x="62" y="16" width="10" height="8" class="voll"/>' + T(28, 58, e.text || "PC", 'font-size="10" text-anchor="middle"'),
    felder: [["text", "Beschriftung"]] },
  led: { modus: "schaltplan", name: "LED", w: 60, h: 20, pins: [[0, 10, "Anode (+)"], [60, 10, "Kathode (−)"]],
    svg: (e) => '<path d="M0 10h20M40 10h20"/><path d="M20 0v20l20-10z" class="voll"/><path d="M40 0v20" class="dick"/><path d="M30 -2l6 -8M36 -2l6 -8"/><path d="M36 -10l-3 1 2 2zM42 -10l-3 1 2 2z" class="voll"/>' + (e.text ? T(30, 34, e.text, 'font-size="11" text-anchor="middle"') : ""),
    felder: [["text", "Beschriftung (z. B. LED rot)"]] },
  widerstand: { modus: "schaltplan", name: "Widerstand", w: 60, h: 20, pins: [[0, 10, "1"], [60, 10, "2"]],
    svg: (e) => '<path d="M0 10h15M45 10h15"/><rect x="15" y="4" width="30" height="12"/>' + T(30, -3, e.text || "220 Ω", 'font-size="11" text-anchor="middle"'),
    felder: [["text", "Wert (z. B. 220 Ω)"]] },
  taster: { modus: "schaltplan", name: "Taster", w: 60, h: 30, pins: [[0, 25, "1"], [60, 25, "2"]],
    svg: (e) => '<path d="M0 25h16M44 25h16"/><circle cx="17" cy="25" r="1.6" class="voll"/><circle cx="43" cy="25" r="1.6" class="voll"/><path d="M17 25L44 15"/><path d="M30 19V4M24 4h12"/>' + (e.text ? T(30, 42, e.text, 'font-size="11" text-anchor="middle"') : ""),
    felder: [["text", "Beschriftung"]] },
  summer: { modus: "schaltplan", name: "Summer (Buzzer)", w: 60, h: 40, pins: [[0, 30, "+"], [60, 30, "−"]],
    svg: (e) => '<path d="M0 30h20M40 30h20M20 30V22h20v8"/><path d="M20 22a10 10 0 0 1 20 0" />' + T(14, 26, "+", 'font-size="10"') + (e.text ? T(30, 48, e.text, 'font-size="11" text-anchor="middle"') : ""),
    felder: [["text", "Beschriftung"]] },
  motor: { modus: "schaltplan", name: "Motor", w: 60, h: 40, pins: [[0, 20, "1"], [60, 20, "2"]],
    svg: (e) => '<path d="M0 20h15M45 20h15"/><circle cx="30" cy="20" r="15"/>' + T(30, 25, "M", 'font-size="14" text-anchor="middle"') + (e.text ? T(30, 50, e.text, 'font-size="11" text-anchor="middle"') : ""),
    felder: [["text", "Beschriftung"]] },
  poti: { modus: "schaltplan", name: "Potentiometer", w: 60, h: 40, pins: [[0, 20, "1"], [60, 20, "3"], [30, 40, "Schleifer"]],
    svg: (e) => '<path d="M0 20h15M45 20h15M30 40V29"/><rect x="15" y="14" width="30" height="12"/><path d="M30 26l-3 5h6z" class="voll"/>' + T(30, 9, e.text || "10 kΩ", 'font-size="11" text-anchor="middle"'),
    felder: [["text", "Wert"]] },
  display: { modus: "schaltplan", name: "Display (I²C)", w: 120, h: 70, pins: [[15, 70, "GND"], [45, 70, "VCC"], [75, 70, "SDA"], [105, 70, "SCL"]],
    svg: (e) => '<rect x="0" y="0" width="120" height="50" class="dick"/><rect x="10" y="8" width="100" height="24"/>' + T(60, 24, e.text || "LCD 16×2", 'font-size="11" text-anchor="middle"') +
      [["GND", 15], ["VCC", 45], ["SDA", 75], ["SCL", 105]].map(([n, x]) => '<path d="M' + x + ' 50v20"/>' + T(x, 45, n, 'font-size="8" text-anchor="middle"')).join(""),
    felder: [["text", "Beschriftung"]] },
  oled: { modus: "schaltplan", name: "OLED-Display (I²C)", w: 120, h: 70, pins: [[30, 70, "GND"], [50, 70, "VCC"], [70, 70, "SCL"], [90, 70, "SDA"]],
    svg: (e) => '<rect x="0" y="0" width="120" height="50" class="dick"/><rect x="14" y="6" width="92" height="28" class="voll"/>' + T(60, 24, e.text || "OLED 128×64", 'font-size="10" text-anchor="middle" style="fill:#fff"') + modulPins([["GND", 30], ["VCC", 50], ["SCL", 70], ["SDA", 90]], 50),
    felder: [["text", "Beschriftung"]] },
  segment7: { modus: "schaltplan", name: "7-Segment (TM1637)", w: 120, h: 70, pins: [[30, 70, "CLK"], [50, 70, "DIO"], [70, 70, "VCC"], [90, 70, "GND"]],
    svg: (e) => '<rect x="0" y="0" width="120" height="50" class="dick"/>' + T(60, 30, "8.8:8.8", 'font-size="20" text-anchor="middle" font-weight="700"') + T(60, -4, e.text || "TM1637", 'font-size="10" text-anchor="middle"') + modulPins([["CLK", 30], ["DIO", 50], ["VCC", 70], ["GND", 90]], 50),
    felder: [["text", "Beschriftung"]] },
  ledstreifen: { modus: "schaltplan", name: "LED-Streifen (WS2812)", w: 150, h: 60, pins: [[0, 10, "5V"], [0, 30, "DIN"], [0, 50, "GND"]],
    svg: (e) => '<path d="M0 10h20M0 30h20M0 50h20"/><rect x="20" y="0" width="130" height="60" class="dick"/>' + [0, 1, 2, 3].map(i => '<rect x="' + (62 + i * 22) + '" y="22" width="14" height="14"/><circle cx="' + (69 + i * 22) + '" cy="29" r="3" class="voll"/>').join("") +
      T(24, 13, "+5V", 'font-size="8"') + T(24, 33, "DIN", 'font-size="8"') + T(24, 53, "GND", 'font-size="8"') + T(85, -4, e.text || "LED-Streifen", 'font-size="10" text-anchor="middle"'),
    felder: [["text", "Beschriftung (z. B. 8 LEDs)"]] },
  ultraschall: { modus: "schaltplan", name: "Ultraschall (HC-SR04)", w: 100, h: 70, pins: [[20, 70, "VCC"], [40, 70, "Trig"], [60, 70, "Echo"], [80, 70, "GND"]],
    svg: (e) => '<rect x="0" y="0" width="100" height="50" class="dick"/><circle cx="27" cy="20" r="13"/><circle cx="73" cy="20" r="13"/><circle cx="27" cy="20" r="6"/><circle cx="73" cy="20" r="6"/>' + T(50, -4, e.text || "HC-SR04", 'font-size="10" text-anchor="middle"') + modulPins([["VCC", 20], ["Trig", 40], ["Echo", 60], ["GND", 80]], 50, 7),
    felder: [["text", "Beschriftung"]] },
  ldr: { modus: "schaltplan", name: "Lichtsensor (LDR)", w: 60, h: 20, pins: [[0, 10, "1"], [60, 10, "2"]],
    svg: (e) => '<path d="M0 10h15M45 10h15"/><rect x="15" y="4" width="30" height="12"/><path d="M14 -14l8 10M24 -16l8 10"/><path d="M22 -4l-4 -1 2 -3zM32 -6l-4 -1 2 -3z" class="voll"/>' + T(30, 30, e.text || "LDR", 'font-size="11" text-anchor="middle"'),
    felder: [["text", "Beschriftung"]] },
  temp: { modus: "schaltplan", name: "Temperatursensor", w: 60, h: 70, pins: [[10, 70, "VCC"], [30, 70, "OUT"], [50, 70, "GND"]],
    svg: (e) => '<rect x="0" y="0" width="60" height="50" class="dick"/><path d="M27 8v20a6 6 0 1 0 6 0V8a3 3 0 0 0-6 0z"/><circle cx="30" cy="33" r="3" class="voll"/>' + T(30, -4, e.text || "LM35 / DHT11", 'font-size="10" text-anchor="middle"') + modulPins([["VCC", 10], ["OUT", 30], ["GND", 50]], 50, 7),
    felder: [["text", "Beschriftung"]] },
  pir: { modus: "schaltplan", name: "Bewegungsmelder (PIR)", w: 60, h: 70, pins: [[10, 70, "VCC"], [30, 70, "OUT"], [50, 70, "GND"]],
    svg: (e) => '<rect x="0" y="10" width="60" height="40" class="dick"/><path d="M12 10a18 16 0 0 1 36 0"/><path d="M18 6l6 -6M30 2v-8M42 6l-6 -6" style="stroke-width:1"/>' + T(30, 34, e.text || "PIR", 'font-size="10" text-anchor="middle"') + modulPins([["VCC", 10], ["OUT", 30], ["GND", 50]], 50, 7),
    felder: [["text", "Beschriftung"]] },
  servo: { modus: "schaltplan", name: "Servo", w: 60, h: 70, pins: [[10, 70, "Signal"], [30, 70, "+"], [50, 70, "−"]],
    svg: (e) => '<rect x="0" y="0" width="60" height="50" class="dick"/><circle cx="30" cy="20" r="11"/>' + T(30, 24, "M", 'font-size="12" text-anchor="middle"') + '<path d="M30 9V-6M22 -6h16"/>' + T(64, 8, e.text || "Servo", 'font-size="10"') + modulPins([["S", 10], ["+", 30], ["−", 50]], 50, 8),
    felder: [["text", "Beschriftung"]] },
  schalter: { modus: "schaltplan", name: "Schalter (Kipp)", w: 60, h: 30, pins: [[0, 25, "1"], [60, 25, "2"]],
    svg: (e) => '<path d="M0 25h16M44 25h16"/><circle cx="17" cy="25" r="1.6" class="voll"/><circle cx="43" cy="25" r="1.6" class="voll"/><path d="M17 25L42 12"/>' + (e.text ? T(30, 8, e.text, 'font-size="11" text-anchor="middle"') : ""),
    felder: [["text", "Beschriftung"]] },
  batterie: { modus: "schaltplan", name: "Batterie", w: 60, h: 40, pins: [[0, 20, "+"], [60, 20, "−"]],
    svg: (e) => '<path d="M0 20h26M34 20h26M26 4v32"/><path d="M34 11v18" style="stroke-width:4"/>' + T(18, 6, "+", 'font-size="12"') + T(30, 50, e.text || "9 V", 'font-size="11" text-anchor="middle"'),
    felder: [["text", "Spannung (z. B. 9 V)"]] },
  diode: { modus: "schaltplan", name: "Diode", w: 60, h: 20, pins: [[0, 10, "Anode (+)"], [60, 10, "Kathode (−)"]],
    svg: (e) => '<path d="M0 10h20M40 10h20"/><path d="M20 0v20l20-10z" class="voll"/><path d="M40 0v20" class="dick"/>' + (e.text ? T(30, 32, e.text, 'font-size="11" text-anchor="middle"') : ""),
    felder: [["text", "Beschriftung (z. B. 1N4007)"]] },
  kondensator: { modus: "schaltplan", name: "Kondensator", w: 60, h: 40,
    pins: (e) => e.gepolt ? [[0, 20, "+"], [60, 20, "−"]] : [[0, 20, "1"], [60, 20, "2"]],
    svg: (e) => '<path d="M0 20h26M34 20h26M26 6v28"/>' + (e.gepolt ? '<path d="M38 6a20 20 0 0 0 0 28"/>' + T(16, 10, "+", 'font-size="12"') : '<path d="M34 6v28"/>') + T(30, 50, e.text || (e.gepolt ? "100 µF" : "100 nF"), 'font-size="11" text-anchor="middle"'),
    felder: [["text", "Wert"], ["gepolt", "Gepolt (Elko, mit + und −)", "janein"]] },
  transistor: { modus: "schaltplan", name: "Transistor (NPN)", w: 60, h: 60, pins: [[0, 30, "B"], [40, 0, "C"], [40, 60, "E"]],
    svg: (e) => '<circle cx="32" cy="30" r="20"/><path d="M0 30h24M24 18v24" /><path d="M24 18v24" class="dick"/><path d="M24 25L40 14V0M24 35L40 46V60"/><path d="M40 46l-7 -1 3 -5z" class="voll"/>' +
      T(4, 24, "B", 'font-size="9"') + T(44, 10, "C", 'font-size="9"') + T(44, 56, "E", 'font-size="9"') + T(58, 34, e.text || "BC547", 'font-size="10"'),
    felder: [["text", "Typ (z. B. BC547)"]] },
  relais: { modus: "schaltplan", name: "Relais-Modul", w: 100, h: 100, pins: [[20, 0, "COM"], [50, 0, "NO"], [80, 0, "NC"], [20, 100, "IN"], [50, 100, "VCC"], [80, 100, "GND"]],
    svg: (e) => '<path d="M20 0v20M50 0v20M80 0v20M20 80v20M50 80v20M80 80v20"/><rect x="0" y="20" width="100" height="60" class="dick"/><rect x="14" y="42" width="22" height="16"/><path d="M14 42l22 16" style="stroke-width:1"/><path d="M36 50h10" style="stroke-dasharray:3 2;stroke-width:1"/><path d="M50 62L64 40M64 40v-4M50 62v6"/>' +
      T(20, 31, "COM", 'font-size="7" text-anchor="middle"') + T(50, 31, "NO", 'font-size="7" text-anchor="middle"') + T(80, 31, "NC", 'font-size="7" text-anchor="middle"') + T(20, 76, "IN", 'font-size="7" text-anchor="middle"') + T(50, 76, "VCC", 'font-size="7" text-anchor="middle"') + T(80, 76, "GND", 'font-size="7" text-anchor="middle"') + T(104, 54, e.text || "Relais", 'font-size="10"'),
    felder: [["text", "Beschriftung"]] },
  rgb: { modus: "schaltplan", name: "RGB-LED", w: 80, h: 60, pins: [[10, 60, "R"], [30, 60, "−"], [50, 60, "G"], [70, 60, "B"]],
    svg: (e) => '<circle cx="40" cy="22" r="18"/>' + T(40, 26, "RGB", 'font-size="10" text-anchor="middle"') + '<path d="M10 60V44L28 34M30 60V40M50 60V44L46 39M70 60V44L52 34"/>' + [["R", 10], ["−", 30], ["G", 50], ["B", 70]].map(([n, x]) => T(x + 3, 56, n, 'font-size="8"')).join("") + '<path d="M54 2l6 -8M60 6l6 -8"/>' + (e.text ? T(40, -12, e.text, 'font-size="10" text-anchor="middle"') : ""),
    felder: [["text", "Beschriftung (z. B. gemeinsame Kathode)"]] },
  masse: { modus: "schaltplan", name: "Masse (GND)", w: 20, h: 20, pins: [[10, 0, "GND"]], svg: () => '<path d="M10 0v10M0 10h20M4 14h12M8 18h4"/>' },
  plus: { modus: "schaltplan", name: "+5 V", w: 20, h: 20, pins: [[10, 20, "5V"]], svg: (e) => '<path d="M10 20V6M4 6h12"/>' + T(10, 2, e.text || "+5V", 'font-size="10" text-anchor="middle"'), felder: [["text", "Spannung"]] },
  knoten: { modus: "schaltplan", name: "Verbindungspunkt", w: 0, h: 0, pins: [[0, 0, "Knoten"]], svg: () => '<circle cx="0" cy="0" r="3" class="voll"/>' },
  text: { modus: "*", name: "Text", w: 0, h: 0, svg: (e, k = 1) => '<text x="0" y="0" font-size="' + r2((e.groesse || 14) / k) + '" class="txt">' + esc(e.text || "Text") + "</text>", felder: [["text", "Text"], ["groesse", "Schriftgröße", "zahl"]] },

  /* ---- Flussdiagramm (DIN 66001) ---- */
  start: { modus: "fluss", name: "Start / Ende", w: 140, h: 40, form: true, svg: (e) => '<rect x="0" y="0" width="' + e.w + '" height="' + e.h + '" rx="' + e.h / 2 + '"/>' + mehrzeilig(e.w / 2, e.h / 2, e.text ?? "Start"), felder: [["text", "Text", "lang"], ["w", "Breite", "zahl"], ["h", "Höhe", "zahl"]] },
  op: { modus: "fluss", name: "Anweisung", w: 160, h: 50, form: true, svg: (e) => '<rect x="0" y="0" width="' + e.w + '" height="' + e.h + '"/>' + mehrzeilig(e.w / 2, e.h / 2, e.text ?? "Anweisung"), felder: [["text", "Text", "lang"], ["w", "Breite", "zahl"], ["h", "Höhe", "zahl"]] },
  verzweigung: { modus: "fluss", name: "Verzweigung", w: 160, h: 80, form: true, svg: (e) => '<path d="M' + e.w / 2 + ' 0L' + e.w + " " + e.h / 2 + "L" + e.w / 2 + " " + e.h + "L0 " + e.h / 2 + 'z"/>' + mehrzeilig(e.w / 2, e.h / 2, e.text ?? "Bedingung?", 12), felder: [["text", "Bedingung", "lang"], ["w", "Breite", "zahl"], ["h", "Höhe", "zahl"]] },
  ea: { modus: "fluss", name: "Ein-/Ausgabe", w: 160, h: 50, form: true, svg: (e) => '<path d="M15 0H' + e.w + "L" + (e.w - 15) + " " + e.h + 'H0z"/>' + mehrzeilig(e.w / 2, e.h / 2, e.text ?? "Ausgabe"), felder: [["text", "Text", "lang"], ["w", "Breite", "zahl"], ["h", "Höhe", "zahl"]] },
  unter: { modus: "fluss", name: "Unterprogramm", w: 160, h: 50, form: true, svg: (e) => '<rect x="0" y="0" width="' + e.w + '" height="' + e.h + '"/><path d="M10 0v' + e.h + "M" + (e.w - 10) + " 0v" + e.h + '"/>' + mehrzeilig(e.w / 2, e.h / 2, e.text ?? "Unterprogramm"), felder: [["text", "Text", "lang"], ["w", "Breite", "zahl"], ["h", "Höhe", "zahl"]] },
  verbinder: { modus: "fluss", name: "Verbindungsstelle", w: 30, h: 30, form: true, svg: (e) => '<circle cx="' + e.w / 2 + '" cy="' + e.h / 2 + '" r="' + e.w / 2 + '"/>' + mehrzeilig(e.w / 2, e.h / 2, e.text ?? "A", 12), felder: [["text", "Zeichen"]] },

  /* ---- Technische Zeichnung (Einheit: mm) ---- */
  platte: { modus: "bauplan", name: "Platte / Umriss", w: 120, h: 80, form: true, svg: (e, k) => '<rect x="0" y="0" width="' + e.w + '" height="' + e.h + '" rx="' + (e.radius || 0) + '" style="stroke-width:' + r2(0.5 / k) + '"/>' + (e.mittellinien ? mittelkreuz(e.w / 2, e.h / 2, e.w / 2, e.h / 2, k) : ""),
    felder: [["x", "X links (vom Blattrand)", "laenge"], ["y", "Y oben (vom Blattrand)", "laenge"], ["w", "Breite", "laenge"], ["h", "Höhe", "laenge"], ["radius", "Eckenradius", "laenge"], ["mittellinien", "Mittellinien", "janein"]] },
  ausschnitt: { modus: "bauplan", name: "Ausschnitt (z. B. Display)", w: 72, h: 25, form: true, svg: (e, k) => '<rect x="0" y="0" width="' + e.w + '" height="' + e.h + '" rx="' + (e.radius || 0) + '" style="stroke-width:' + r2(0.5 / k) + '"/>' + (e.mitte !== false ? mittelkreuz(e.w / 2, e.h / 2, e.w / 2, e.h / 2, k) : ""),
    felder: [["x", "X links (vom Blattrand)", "laenge"], ["y", "Y oben (vom Blattrand)", "laenge"], ["w", "Breite", "laenge"], ["h", "Höhe", "laenge"], ["radius", "Eckenradius", "laenge"], ["mitte", "Mittellinien", "janein"]] },
  bohrung: { modus: "bauplan", name: "Bohrung", w: 0, h: 0, d: 5, svg: (e, k) => bohrSvg(e, k),
    felder: (e) => [["art", "Art", "wahl", [["durch", "Durchgangsbohrung"], ["gewinde", "Gewinde (M3, M4 …)"], ["senk", "Senkbohrung (Senkkopfschraube)"], ["langloch", "Langloch"]]],
      ["d", e.art === "gewinde" ? "Gewinde M… (Nenndurchmesser)" : e.art === "langloch" ? "Breite des Langlochs" : "Durchmesser", "laenge"],
      ...(e.art === "senk" ? [["senkD", "Senkdurchmesser (oben)", "laenge"]] : []),
      ...(e.art === "langloch" ? [["laenge", "Länge (Mitte bis Mitte)", "laenge"], ["richtung", "Richtung", "wahl", [["h", "waagerecht"], ["v", "senkrecht"]]]] : []),
      ["x", "Mitte X (vom Blattrand)", "laenge"], ["y", "Mitte Y (vom Blattrand)", "laenge"], ["mitte", "Mittellinien", "janein"], ["dmass", e.art === "gewinde" ? "Gewinde beschriften" : "⌀ bemaßen", "janein"]] }
};
function mittelkreuz(cx, cy, rx, ry, k) {
  const u = 2 / k, s = 'class="mittel" style="stroke-width:' + r2(0.25 / k) + ";stroke-dasharray:" + [8, 1.5, 1, 1.5].map(v => r2(v / k)).join(" ") + '"';
  return '<path d="M' + r2(cx - rx - u) + " " + cy + "H" + r2(cx + rx + u) + "M" + cx + " " + r2(cy - ry - u) + "V" + r2(cy + ry + u) + '" ' + s + "/>";
}
function pfeilSpitze(x, y, wx, wy, k) {   // Spitze bei (x,y), zeigt in Richtung (wx,wy)
  const l = 2.5 / k, b = 0.6 / k, bx = x - wx * l, by = y - wy * l;
  return '<path d="M' + r2(x) + " " + r2(y) + "L" + r2(bx - wy * b) + " " + r2(by + wx * b) + "L" + r2(bx + wy * b) + " " + r2(by - wx * b) + 'z" class="voll" style="stroke-width:0"/>';
}
// Ausdehnung einer Bohrung von der Mitte aus (Langloch ist breiter bzw. höher)
export function bohrMass(e) {
  const r = (e.art === "senk" ? (e.senkD || e.d * 2) : e.d) / 2, L = e.art === "langloch" ? (e.laenge || 10) / 2 : 0, v = e.richtung === "v";
  return { rx: r + (v ? 0 : L), ry: r + (v ? L : 0), L, v, r };
}
function bohrText(e) {
  if (e.art === "gewinde") return "M" + masszahl(e.d);
  if (e.art === "senk") return "⌀" + masszahl(e.d) + " / ⌵⌀" + masszahl(e.senkD || e.d * 2) + "×90°";
  if (e.art === "langloch") return masszahl(e.d) + " × " + masszahl((e.laenge || 10) + e.d);
  return "⌀" + masszahl(e.d);
}
function bohrSvg(e, k) {
  const s = (w) => 'style="stroke-width:' + r2(w / k) + '"', { L, v } = bohrMass(e), r = e.d / 2;
  let o = "";
  if (e.art === "langloch") {
    o += v ? '<path d="M' + r2(-r) + " " + r2(-L) + "A" + r + " " + r + " 0 0 1 " + r + " " + r2(-L) + "V" + L + "A" + r + " " + r + " 0 0 1 " + r2(-r) + " " + L + 'z" ' + s(0.5) + "/>"
      : '<path d="M' + r2(-L) + " " + r2(-r) + "H" + L + "A" + r + " " + r + " 0 0 1 " + L + " " + r + "H" + r2(-L) + "A" + r + " " + r + " 0 0 1 " + r2(-L) + " " + r2(-r) + 'z" ' + s(0.5) + "/>";
    if (e.mitte !== false) o += v ? mittelkreuz(0, -L, r, r, k) + mittelkreuz(0, L, r, r, k) : mittelkreuz(-L, 0, r, r, k) + mittelkreuz(L, 0, r, r, k);
  } else if (e.art === "gewinde") {
    // Draufsicht nach Norm: Kernloch als Volllinie, Gewinde-Außendurchmesser als Dreiviertelkreis (schmal)
    const rk = r2(r * 0.82);
    o += '<circle cx="0" cy="0" r="' + rk + '" ' + s(0.5) + "/>" + '<path d="M' + r + " 0A" + r + " " + r + " 0 1 1 0 " + r2(-r) + '" ' + s(0.25) + "/>";
    if (e.mitte !== false) o += mittelkreuz(0, 0, r, r, k);
  } else {
    o += '<circle cx="0" cy="0" r="' + r + '" ' + s(0.5) + "/>";
    if (e.art === "senk") o += '<circle cx="0" cy="0" r="' + r2((e.senkD || e.d * 2) / 2) + '" ' + s(0.5) + "/>";
    if (e.mitte !== false) { const m = bohrMass(e); o += mittelkreuz(0, 0, m.rx, m.ry, k); }
  }
  return o + (e.dmass ? durchmesser(e, k) : "");
}
function durchmesser(e, k) {
  const { rx, L, v, r: rr } = bohrMass(e), r = e.art === "langloch" ? e.d / 2 : rr, a = Math.PI / 4, px = Math.cos(a) * r + (e.art === "langloch" && !v ? L : 0), py = -Math.sin(a) * r - (e.art === "langloch" && v ? L : 0), kx = px + 6 / k, ky = py - 6 / k, t = bohrText(e), tw = (t.length * 2.1 + 1) / k;
  return '<g style="stroke-width:' + r2(0.25 / k) + '"><path d="M' + r2(px) + " " + r2(py) + "L" + r2(kx) + " " + r2(ky) + "h" + r2(tw) + '"/>' + pfeilSpitze(px, py, -Math.cos(a), Math.sin(a), k) +
    '<text x="' + r2(kx + 0.5 / k) + '" y="' + r2(ky - 0.8 / k) + '" font-size="' + r2(3.5 / k) + '" class="txt">' + t + "</text></g>";
}

// Linien-Arten
export const LINIEN = {
  draht: { modus: "schaltplan", name: "Leitung", viele: true },
  pfeil: { modus: "fluss", name: "Pfeil", viele: true, felder: [["text", "Beschriftung (ja / nein)"]] },
  linie: { modus: "bauplan", name: "Linie", felder: [["stil", "Linienart", "wahl", [["voll", "Volllinie (Kante)"], ["verdeckt", "Strichlinie (verdeckte Kante)"], ["mittel", "Strichpunktlinie (Mittellinie)"], ["schmal", "schmale Volllinie"]]]] },
  kette: { modus: "bauplan", name: "Maßkette", viele: true },
  mass: { modus: "bauplan", name: "Bemaßung", felder: [["abstand", "Abstand zur Kante", "laenge"], ["text", "Maßzahl selbst eintragen (leer = gemessen)"]] }
};

const PALETTE = {
  schaltplan: ["#Arduino", "arduino", "nano", "mega", "usb", "#Bauteile", "led", "rgb", "widerstand", "taster", "schalter", "poti", "diode", "kondensator", "transistor", "relais", "batterie",
    "#Bewegung & Ton", "summer", "motor", "servo", "#Sensoren", "ultraschall", "ldr", "temp", "pir", "#Anzeigen", "display", "oled", "segment7", "ledstreifen", "#Verbinden", "masse", "plus", "knoten", "draht", "text"],
  fluss: ["start", "op", "verzweigung", "ea", "unter", "verbinder", "pfeil", "text"],
  bauplan: ["platte", "ausschnitt", "bohrung", "linie", "mass", "kette", "text"]
};
const TITEL = { schaltplan: "Schaltplan", fluss: "Flussdiagramm", bauplan: "Technische Zeichnung" };
const RASTER = { schaltplan: 10, fluss: 10, bauplan: 1 };

/* ================= Geometrie ================= */
function drehen(px, py, e) {          // lokaler Punkt → Welt (mit Drehung um die Mitte)
  const s = SYM[e.typ], w = e.w ?? s.w, h = e.h ?? s.h, r = ((e.rot || 0) % 360) * Math.PI / 180, cx = w / 2, cy = h / 2;
  const dx = px - cx, dy = py - cy;
  return [r2(e.x + cx + dx * Math.cos(r) - dy * Math.sin(r)), r2(e.y + cy + dx * Math.sin(r) + dy * Math.cos(r))];
}
function anschluesse(e) {             // [x, y, name]
  const s = SYM[e.typ]; if (!s) return [];
  if (s.pins) return (typeof s.pins === "function" ? s.pins(e) : s.pins).map(([x, y, n]) => [...drehen(x, y, e), n]);
  if (s.modus === "fluss") { const w = e.w, h = e.h; return [[w / 2, 0, "oben"], [w / 2, h, "unten"], [0, h / 2, "links"], [w, h / 2, "rechts"]].map(([x, y, n]) => [r2(e.x + x), r2(e.y + y), n]); }
  if (e.typ === "bohrung") { const { rx, ry, L, v } = bohrMass(e), a = [[e.x, e.y, "Mitte"], [e.x - rx, e.y, "links"], [e.x + rx, e.y, "rechts"], [e.x, e.y - ry, "oben"], [e.x, e.y + ry, "unten"]];
    if (L) a.push(v ? [e.x, e.y - L, "Mitte oben"] : [e.x - L, e.y, "Mitte links"], v ? [e.x, e.y + L, "Mitte unten"] : [e.x + L, e.y, "Mitte rechts"]); return a.map(q => [r2(q[0]), r2(q[1]), q[2]]); }
  if (e.typ === "platte" || e.typ === "ausschnitt") { const { x, y, w, h } = e; return [[x, y], [x + w, y], [x, y + h], [x + w, y + h], [x + w / 2, y], [x + w / 2, y + h], [x, y + h / 2], [x + w, y + h / 2], [x + w / 2, y + h / 2]].map(p => [r2(p[0]), r2(p[1]), ""]); }
  return [];
}
function linieSvg(l, k, modus) {
  const p = l.punkte; if (!p || p.length < 2) return "";
  const d = "M" + p.map(q => q.join(" ")).join("L");
  if (l.typ === "draht") return '<path d="' + d + '" class="draht"/>';
  if (l.typ === "pfeil") { const a = p[p.length - 2], b = p[p.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, m = p[Math.floor((p.length - 1) / 2)], n2 = p[Math.floor((p.length - 1) / 2) + 1];
    return '<path d="' + d + '"/>' + '<path d="M' + b[0] + " " + b[1] + "l" + r2(-(b[0] - a[0]) / L * 10 - (b[1] - a[1]) / L * 4) + " " + r2(-(b[1] - a[1]) / L * 10 + (b[0] - a[0]) / L * 4) + "l" + r2((b[1] - a[1]) / L * 8) + " " + r2(-(b[0] - a[0]) / L * 8) + 'z" class="voll"/>' +
      (l.text ? T(r2((m[0] + n2[0]) / 2 + 6), r2((m[1] + n2[1]) / 2 - 5), l.text, 'font-size="12"') : ""); }
  if (l.typ === "linie") { const st = l.stil || "voll", w = st === "voll" ? 0.5 : 0.25, da = st === "verdeckt" ? [3, 1.5] : st === "mittel" ? [8, 1.5, 1, 1.5] : null;
    return '<path d="' + d + '" style="stroke-width:' + r2(w / k) + (da ? ";stroke-dasharray:" + da.map(v => r2(v / k)).join(" ") : "") + '"/>'; }
  if (l.typ === "mass") return massSvg(l, k);
  if (l.typ === "kette") return '<path d="' + d + '" style="stroke-width:' + r2(0.3 / k) + ";stroke-dasharray:" + r2(1.5 / k) + " " + r2(1 / k) + '"/>' + p.map(q => '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="' + r2(0.9 / k) + '" class="voll"/>').join("");
  return "";
}
function massSvg(l, k) {
  if (l.richtung === "h" || l.richtung === "v") return massKetteSvg(l, k);
  const [p1, p2] = l.punkte, dx = p2[0] - p1[0], dy = p2[1] - p1[1], L = Math.hypot(dx, dy); if (!L) return "";
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux, a = l.abstand ?? 10, sg = a < 0 ? -1 : 1, ue = 2 / k;
  const q1 = [p1[0] + nx * a, p1[1] + ny * a], q2 = [p2[0] + nx * a, p2[1] + ny * a];
  let h = '<g style="stroke-width:' + r2(0.25 / k) + '">';
  h += '<path d="M' + r2(p1[0]) + " " + r2(p1[1]) + "L" + r2(q1[0] + nx * ue * sg) + " " + r2(q1[1] + ny * ue * sg) + "M" + r2(p2[0]) + " " + r2(p2[1]) + "L" + r2(q2[0] + nx * ue * sg) + " " + r2(q2[1] + ny * ue * sg) + '"/>';
  h += '<path d="M' + r2(q1[0]) + " " + r2(q1[1]) + "L" + r2(q2[0]) + " " + r2(q2[1]) + '"/>' + pfeilSpitze(q1[0], q1[1], -ux, -uy, k) + pfeilSpitze(q2[0], q2[1], ux, uy, k);
  let w = Math.atan2(uy, ux) * 180 / Math.PI; if (w >= 89.99) w -= 180; if (w < -90.01) w += 180;
  const t = l.text ? String(l.text) : masszahl(L), rad = w * Math.PI / 180, mx = (q1[0] + q2[0]) / 2 + Math.sin(rad) * 1 / k, my = (q1[1] + q2[1]) / 2 - Math.cos(rad) * 1 / k;
  h += '<text x="' + r2(mx) + '" y="' + r2(my) + '" font-size="' + r2(3.5 / k) + '" text-anchor="middle" class="txt" transform="rotate(' + r2(w) + " " + r2(mx) + " " + r2(my) + ')">' + esc(t) + "</text></g>";
  return h;
}
// Teil einer Maßkette: waagerecht (h) oder senkrecht (v), Maßlinie auf fester Höhe „lage“
function massKetteSvg(l, k) {
  const [p1, p2] = l.punkte, h = l.richtung === "h", ue = 2 / k;
  const a = h ? p1[0] : p1[1], b = h ? p2[0] : p2[1], L = Math.abs(b - a); if (!L) return "";
  const lage = l.lage, sg1 = Math.sign(lage - (h ? p1[1] : p1[0])) || 1, sg2 = Math.sign(lage - (h ? p2[1] : p2[0])) || 1;
  const P = (u, v) => h ? [u, v] : [v, u];
  const q1 = P(a, lage), q2 = P(b, lage), e1 = P(a, lage + sg1 * ue), e2 = P(b, lage + sg2 * ue), dir = Math.sign(b - a);
  let o = '<g style="stroke-width:' + r2(0.25 / k) + '"><path d="M' + r2(p1[0]) + " " + r2(p1[1]) + "L" + r2(e1[0]) + " " + r2(e1[1]) + "M" + r2(p2[0]) + " " + r2(p2[1]) + "L" + r2(e2[0]) + " " + r2(e2[1]) + "M" + r2(q1[0]) + " " + r2(q1[1]) + "L" + r2(q2[0]) + " " + r2(q2[1]) + '"/>';
  o += pfeilSpitze(q1[0], q1[1], h ? -dir : 0, h ? 0 : -dir, k) + pfeilSpitze(q2[0], q2[1], h ? dir : 0, h ? 0 : dir, k);
  const t = l.text ? String(l.text) : masszahl(L), m = (a + b) / 2, tp = h ? [m, lage - 1 / k] : [lage - 1 / k, m];
  o += '<text x="' + r2(tp[0]) + '" y="' + r2(tp[1]) + '" font-size="' + r2(3.5 / k) + '" text-anchor="middle" class="txt"' + (h ? "" : ' transform="rotate(-90 ' + r2(tp[0]) + " " + r2(tp[1]) + ')"') + ">" + esc(t) + "</text></g>";
  return o;
}
function elementSvg(e, k) {
  const s = SYM[e.typ]; if (!s) return "";
  if (s.modus === "bauplan" && e.typ !== "text" || e.typ === "bohrung") return '<g transform="translate(' + e.x + " " + e.y + ')">' + s.svg(e, k) + "</g>";
  if (e.typ === "text") return '<g transform="translate(' + e.x + " " + e.y + ')">' + s.svg(e, k) + "</g>";
  const w = e.w ?? s.w, h = e.h ?? s.h;
  return '<g transform="translate(' + e.x + " " + e.y + ")" + (e.rot ? " rotate(" + e.rot + " " + w / 2 + " " + h / 2 + ")" : "") + '">' + s.svg(Object.assign({ w, h }, e), k) + "</g>";
}

/* ================= Blatt (Rahmen + Schriftfeld) für den Bauplan ================= */
export const BLATT = { w: 297, h: 210 };
export const blattMass = (z) => z && z.blatt === "A3" ? { w: 420, h: 297, name: "A3" } : { w: 297, h: 210, name: "A4" };
function massstabFaktor(m) { const x = /^(\d+(?:[.,]\d+)?)\s*:\s*(\d+(?:[.,]\d+)?)$/.exec(String(m || "1:1").trim()); return x ? Number(x[1].replace(",", ".")) / Number(x[2].replace(",", ".")) || 1 : 1; }
function schriftfeld(sf, B = BLATT) {
  const x0 = B.w - 10 - 180, y0 = B.h - 10 - 28, z = (x, y, w, h) => '<rect x="' + (x0 + x) + '" y="' + (y0 + y) + '" width="' + w + '" height="' + h + '"/>';
  const lab = (x, y, t) => '<text x="' + (x0 + x + 1) + '" y="' + (y0 + y + 2.6) + '" font-size="2">' + esc(t) + "</text>";
  const wert = (x, y, t, g = 3.5) => '<text x="' + (x0 + x + 1.5) + '" y="' + (y0 + y + 6) + '" font-size="' + g + '" class="txt">' + esc(t || "") + "</text>";
  let h = '<g class="sf" style="stroke-width:0.35">' + z(0, 0, 180, 28);
  const sp = [[0, "Name", "name"], [60, "Datum", "datum"], [120, "Maßstab", "massstab"]], sp2 = [[0, "Klasse / Gruppe", "klasse"], [60, "Werkstoff", "werkstoff"], [120, "Blatt", "blatt"]];
  for (const [x, l, k] of sp) h += z(x, 0, 60, 7) + lab(x, 0, l) + wert(x + 14, -1.3, sf[k], 3.2);
  for (const [x, l, k] of sp2) h += z(x, 7, 60, 7) + lab(x, 7, l) + wert(x + 14, 5.7, sf[k], 3.2);
  h += z(0, 14, 130, 14) + lab(0, 14, "Benennung") + wert(0, 17.5, sf.titel, 5) + z(130, 14, 50, 14) + lab(130, 14, "Zeichnungs-Nr.") + wert(130, 17.5, sf.nummer, 3.5);
  return h + "</g>";
}
export function blattSvg(z, mitRaster) {
  const k = massstabFaktor(z.schriftfeld && z.schriftfeld.massstab), B = blattMass(z);
  let h = '<rect x="0" y="0" width="' + B.w + '" height="' + B.h + '" fill="#fff" stroke="none"/>';
  if (mitRaster) h += '<g class="raster">' + Array.from({ length: Math.floor(B.w / (5 * k)) + 1 }, (_, i) => '<path d="M' + r2(i * 5 * k) + ' 0V' + B.h + '"/>').join("") + Array.from({ length: Math.floor(B.h / (5 * k)) + 1 }, (_, i) => '<path d="M0 ' + r2(i * 5 * k) + "H" + B.w + '"/>').join("") + "</g>";
  h += '<rect x="20" y="10" width="' + (B.w - 30) + '" height="' + (B.h - 20) + '" fill="none" style="stroke-width:0.7"/>' + schriftfeld(z.schriftfeld || {}, B);
  return { h, k };
}

/* ================= SVG zum Speichern/Drucken ================= */
const STIL = 'text{font-family:"Open Sans",Arial,sans-serif;fill:#000;stroke:none}.txt{fill:#000}path,rect,circle{fill:none;stroke:#000;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}.dick{stroke-width:2}.voll{fill:#000}.draht{stroke-width:1.6}.sf rect{stroke-width:.35}.raster path{stroke:#e3e9ec;stroke-width:inherit}.raster{stroke-width:.15}.ansicht-hilfe path{stroke:#4ea1ff}.fang path{stroke:#e8590c;stroke-width:inherit;stroke-dasharray:1.2 .8}.fang-t{fill:#e8590c;font-weight:700}.geist{opacity:.55}';
export function svgText(modus, z) {
  EINH = (z && z.einheit) || "mm";
  if (modus === "bauplan") {
    const { h, k } = blattSvg(z, false);
    const inhalt = (z.el || []).map(e => e.punkte ? linieSvg(e, k, modus) : elementSvg(e, k)).join("");
    const B = blattMass(z);
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + B.w + 'mm" height="' + B.h + 'mm" viewBox="0 0 ' + B.w + " " + B.h + '"><style>' + STIL + "path,rect,circle{stroke-width:.35}</style>" + h + '<g transform="scale(' + k + ')">' + inhalt + "</g></svg>";
  }
  const b = grenzen(z); const inhalt = (z.el || []).map(e => e.punkte ? linieSvg(e, 1, modus) : elementSvg(e, 1)).join("") + (z.titel ? T(b.x, b.y - 8, z.titel, 'font-size="16" font-weight="600"') : "");
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + [b.x - 20, b.y - (z.titel ? 34 : 20), b.w + 40, b.h + (z.titel ? 54 : 40)].join(" ") + '" width="' + (b.w + 40) + '" height="' + (b.h + (z.titel ? 54 : 40)) + '"><style>' + STIL + '</style><rect x="-99999" y="-99999" width="199999" height="199999" fill="#fff" stroke="none"/>' + inhalt + "</svg>";
}
function grenzen(z) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  const nimm = (x, y) => { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); };
  for (const e of z.el || []) {
    if (e.punkte) e.punkte.forEach(p => nimm(p[0], p[1]));
    else { const s = SYM[e.typ], w = e.w ?? s.w, h = e.h ?? s.h; nimm(e.x - 20, e.y - 20); nimm(e.x + Math.max(w, h) + 20, e.y + Math.max(w, h) + 20); if (e.typ === "text") nimm(e.x + String(e.text || "").length * 8, e.y); }
  }
  if (a === Infinity) return { x: 0, y: 0, w: 400, h: 300 };
  return { x: a, y: b, w: c - a, h: d - b };
}
export function druckHtml(modus, z) {
  const svg = svgText(modus, z);
  const B = modus === "bauplan" ? blattMass(z) : BLATT;
  return '<!doctype html><html><head><meta charset="utf-8"><style>@page{size:' + (B.name || "A4") + ' landscape;margin:0}html,body{margin:0;padding:0}' + (modus === "bauplan" ? "svg{display:block;width:" + B.w + "mm;height:" + B.h + "mm}" : "body{display:flex;align-items:center;justify-content:center;width:297mm;height:210mm}svg{max-width:277mm;max-height:190mm;width:auto;height:auto}") + "</style></head><body>" + svg + "</body></html>";
}
export function pngAusSvg(svg, breitePx) {
  return new Promise((ok, nein) => {
    const img = new Image();
    img.onload = () => { const s = breitePx / img.width, c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); ok(c.toDataURL("image/png").split(",")[1]); };
    img.onerror = nein;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.replace(/width="(\d+)mm" height="(\d+)mm"/, (_, w, h) => 'width="' + w * 4 + '" height="' + h * 4 + '"'));
  });
}

/* ================= Pins aus dem Code (nur zum Vergleichen) ================= */
export function pinsAusCode(code) {
  const ohne = String(code).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ""), werte = {};
  for (const m of ohne.matchAll(/(?:const\s+)?(?:int|byte|long)\s+([A-Za-z_]\w*)\s*=\s*(A?\d+)\s*;/g)) werte[m[1]] = m[2];
  for (const m of ohne.matchAll(/#define\s+([A-Za-z_]\w*)\s+(A?\d+)/g)) werte[m[1]] = m[2];
  const pins = new Map(), zeilen = String(code).split("\n");
  const name = (a) => { a = a.trim(); a = werte[a] || a; if (/^A\d$/.test(a)) return a; if (/^\d+$/.test(a)) return Number(a) >= 14 && Number(a) <= 19 ? "A" + (Number(a) - 14) : "D" + a; return null; };
  const regeln = [[/pinMode\s*\(\s*([\w]+)\s*,\s*(OUTPUT|INPUT_PULLUP|INPUT)/g, (m) => m[2] === "OUTPUT" ? "Ausgang" : m[2] === "INPUT_PULLUP" ? "Eingang (Pull-up)" : "Eingang"], [/digitalWrite\s*\(\s*([\w]+)\s*,/g, () => "schreibt HIGH/LOW"], [/digitalRead\s*\(\s*([\w]+)\s*\)/g, () => "liest"], [/analogRead\s*\(\s*([\w]+)\s*\)/g, () => "liest analog"], [/analogWrite\s*\(\s*([\w]+)\s*,/g, () => "PWM"], [/\b(?:no)?[Tt]one\s*\(\s*([\w]+)/g, () => "Ton"]];
  zeilen.forEach((z, i) => { const zz = z.replace(/\/\/.*$/, ""); for (const [re, art] of regeln) for (const m of zz.matchAll(re)) { const p = name(m[1]); if (!p) continue; const x = pins.get(p) || { pin: p, arten: new Set(), zeilen: new Set() }; x.arten.add(art(m)); x.zeilen.add(i + 1); pins.set(p, x); } });
  return [...pins.values()].map(x => ({ pin: x.pin, arten: [...x.arten], zeilen: [...x.zeilen] })).sort((a, b) => a.pin.localeCompare(b.pin, "de", { numeric: true }));
}
export function verbundenePins(z) {
  const enden = []; for (const l of z.el || []) if (l.typ === "draht" && l.punkte) { enden.push(l.punkte[0], l.punkte[l.punkte.length - 1]); }
  const aus = new Set();
  for (const e of z.el || []) if (BRETTER.has(e.typ)) for (const [x, y, n] of anschluesse(e)) if (enden.some(p => Math.abs(p[0] - x) < 0.6 && Math.abs(p[1] - y) < 0.6)) aus.add(n);
  return aus;
}

/* ================= Der Zeichner ================= */
export function leer(modus) { return modus === "bauplan" ? { el: [], schriftfeld: { titel: "Deckplatte", massstab: "1:1", blatt: "1/1", datum: new Date().toLocaleDateString("de-DE"), werkstoff: "" } } : { el: [], titel: "" }; }

export function oeffnen(modus, daten, { speichern, code, KC, toast, name }) {
  let z = JSON.parse(JSON.stringify(daten || leer(modus))); if (!z.el) z.el = [];
  const verlauf = [JSON.stringify(z)]; let vPos = 0;
  let eigenschaftenAus = false, werkzeug = "auswahl", auswahl = null, entwurf = null, ziehen = null, zoom = modus === "bauplan" ? 3.2 : 1, raster = true;
  const R = () => modus === "bauplan" ? (z.raster || 1) : RASTER[modus];
  const k = () => modus === "bauplan" ? massstabFaktor(z.schriftfeld && z.schriftfeld.massstab) : 1;

  const box = document.createElement("div"); box.className = "zeichner"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", TITEL[modus]);
  box.innerHTML = '<div class="z-kopf"><b>' + TITEL[modus] + '</b><span class="leise z-name"></span><span class="sp"></span>' +
    '<button type="button" class="z-k" data-a="rueck" title="Rückgängig (Strg+Z)">↶</button><button type="button" class="z-k" data-a="vor" title="Wiederholen (Strg+Y)">↷</button>' +
    '<button type="button" class="z-k" data-a="drehen" title="Drehen (R)">⟳ Drehen</button><button type="button" class="z-k" data-a="loeschen" title="Löschen (Entf)">🗑 Löschen</button>' +
    '<button type="button" class="z-k" data-a="raster" title="Raster ein/aus">▦ Raster</button><button type="button" class="z-k" data-a="zoom-" title="Verkleinern">−</button><span class="z-zoom"></span><button type="button" class="z-k" data-a="zoom+" title="Vergrößern">+</button>' +
    (modus === "bauplan" ? '<button type="button" class="z-k" data-a="sf">Schriftfeld …</button>' : '<button type="button" class="z-k" data-a="titel">Überschrift …</button>') +
    '<button type="button" class="z-k" data-a="png">PNG</button><button type="button" class="z-k" data-a="svg">SVG</button><button type="button" class="z-k" data-a="pdf">PDF</button><button type="button" class="z-k" data-a="druck">🖨 Drucken</button><button type="button" class="z-k" data-a="notizen" title="Zeichnung in FIDELIA Notizen ablegen (Fach NWT)">→ Notizen</button>' +
    '<button type="button" class="pill klein" data-a="zu">FERTIG</button></div>' +
    '<div class="z-haupt"><div class="z-palette"></div><div class="z-flaeche"><svg class="z-svg" xmlns="http://www.w3.org/2000/svg"></svg></div><div class="z-seite"><div class="z-eig"></div><div class="z-extra"></div></div></div>' +
    '<div class="z-fuss leise"></div>';
  document.body.appendChild(box);
  const svg = box.querySelector(".z-svg"), fuss = box.querySelector(".z-fuss");
  box.querySelector(".z-name").textContent = name ? " · " + name : "";

  // Palette
  const pal = box.querySelector(".z-palette");
  pal.innerHTML = '<button type="button" data-w="auswahl" class="an">⬉ Auswählen</button>' + PALETTE[modus].map(t => t[0] === "#" ? '<div class="z-gruppe">' + esc(t.slice(1)) + "</div>" : '<button type="button" data-w="' + t + '">' + vorschau(t) + "<span>" + esc((SYM[t] || LINIEN[t]).name) + "</span></button>").join("");
  pal.querySelectorAll("[data-w]").forEach(b => b.onclick = () => werkzeugSetzen(b.dataset.w));
  function vorschau(t) {
    if (LINIEN[t]) return '<svg viewBox="0 0 40 20"><path d="M4 16L20 16L20 4L36 4" fill="none" stroke="currentColor" stroke-width="1.6"/>' + (t === "pfeil" || t === "mass" ? '<path d="M36 4l-5-3v6z" fill="currentColor"/>' : "") + "</svg>";
    const s = SYM[t]; if (t === "text") return '<svg viewBox="0 0 40 20"><text x="10" y="15" font-size="14" fill="currentColor">Aa</text></svg>';
    const e = { typ: t, w: s.w || 10, h: s.h || 10, d: s.d || 5, x: 0, y: 0, mitte: false, v: 2, ansicht: s.brett ? "echt" : "symbol" };
    if (s.brett) Object.assign(e, brettMasse(e));
    const w = e.w, h = e.h, pad = s.modus === "bauplan" ? 4 : 8, oben = ["led", "ldr", "rgb", "servo", "pir"].includes(t) ? 14 : 0;
    const bx = t === "bohrung" ? [-4, -4, 8, 8] : t === "knoten" ? [-5, -5, 10, 10] : [-pad, -pad - oben, w + 2 * pad, h + 2 * pad + oben];
    return '<svg viewBox="' + bx.join(" ") + '" class="z-vor">' + s.svg(e, 1).replace(/<text[\s\S]*?<\/text>/g, "") + "</svg>";
  }
  function werkzeugSetzen(w) { werkzeug = w; entwurf = null; geist = null; fangLinien = []; pal.querySelectorAll("[data-w]").forEach(b => b.classList.toggle("an", b.dataset.w === w)); fussText(); malen(); }
  function fussText() {
    const t = { auswahl: "Klick auf ein Teil, um es auszuwählen und zu verschieben. Entf = löschen, R = drehen, Strg+D = verdoppeln.", draht: "Leitung: Klick auf einen Anschluss, dann weitere Punkte; Klick auf einen anderen Anschluss beendet sie. Esc bricht ab.", pfeil: "Pfeil: Klick am Startpunkt (z. B. unten an einem Kasten), dann weitere Punkte; Klick auf einen Anschluss oder Doppelklick beendet ihn.", linie: "Linie: Anfangs- und Endpunkt anklicken. Rastet an Ecken, Mitten und Bohrungen ein.", mass: "Bemaßung: 1. Punkt, 2. Punkt anklicken, dann mit dem dritten Klick festlegen, wo die Maßlinie liegt.", kette: "Maßkette: Punkte nacheinander anklicken (rastet an Kanten, Bohrungen, Mitten ein). Doppelklick dort, wo die Maßlinie liegen soll. Esc bricht ab." };
    fuss.textContent = t[werkzeug] || (SYM[werkzeug] ? "Klick auf die Fläche, um „" + SYM[werkzeug].name + "“ einzusetzen." : "");
  }
  function merken() { const s = JSON.stringify(z); if (s === verlauf[vPos]) return; verlauf.splice(vPos + 1); verlauf.push(s); if (verlauf.length > 80) verlauf.shift(); vPos = verlauf.length - 1; speichern(JSON.parse(s)); }
  function zurueck(d) { const n = vPos + d; if (n < 0 || n >= verlauf.length) return; vPos = n; z = JSON.parse(verlauf[vPos]); auswahl = null; speichern(JSON.parse(verlauf[vPos])); malen(); }

  // Koordinaten
  function punkt(ev) { const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; const q = p.matrixTransform(svg.getScreenCTM().inverse()); return [q.x / k(), q.y / k()]; }
  const einrasten = (v) => raster ? Math.round(v / R()) * R() : r2(v);
  function fang(p, ohneId) {
    const rad = modus === "bauplan" ? 2.5 / k() : 9; let best = null, bd = rad;
    for (const e of z.el) { if (e.id === ohneId) continue; const liste = e.punkte ? (modus === "bauplan" ? e.punkte : []) : anschluesse(e); for (const q of liste) { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = q; } } }
    return best ? { p: [best[0], best[1]], pin: true } : { p: [einrasten(p[0]), einrasten(p[1])], pin: false };
  }

  /* ---- Einrasten von Bohrungen und Ausschnitten an Platten-Mitte, Kanten und anderen Bohrungen ---- */
  let fangLinien = [], geist = null;
  function bezugsPlatte(c, ohneId) {   // kleinste Platte, in der der Punkt liegt
    const drin = z.el.filter(e => e.typ === "platte" && e.id !== ohneId && c[0] >= e.x - 0.01 && c[0] <= e.x + e.w + 0.01 && c[1] >= e.y - 0.01 && c[1] <= e.y + e.h + 0.01);
    return drin.sort((a, b) => a.w * a.h - b.w * b.h)[0] || null;
  }
  // c = gewünschte Mitte; gibt die eingerastete Mitte zurück und merkt sich die Hilfslinien zum Anzeigen
  function achsFang(c, ohneId) {
    const rad = 3 / zoom / k() * 3.2, xs = [], ys = [];
    for (const e of z.el) {
      if (e.id === ohneId || e.punkte) continue;
      if (e.typ === "platte" || e.typ === "ausschnitt") { xs.push([e.x + e.w / 2, "Mitte"], [e.x, "Kante"], [e.x + e.w, "Kante"]); ys.push([e.y + e.h / 2, "Mitte"], [e.y, "Kante"], [e.y + e.h, "Kante"]); }
      if (e.typ === "bohrung") { xs.push([e.x, "Bohrung"]); ys.push([e.y, "Bohrung"]); }
    }
    const best = (v, liste) => { let b = null, bd = rad; for (const [w, art] of liste) { const d = Math.abs(w - v); if (d < bd - 1e-9 || (b && Math.abs(d - bd) < 1e-9 && art === "Mitte")) { bd = d; b = [w, art]; } } return b; };
    const bx = best(c[0], xs), by = best(c[1], ys);
    fangLinien = [];
    const x = bx ? r2(bx[0]) : einrasten(c[0]), y = by ? r2(by[0]) : einrasten(c[1]);
    if (bx) fangLinien.push({ x, art: bx[1] }); if (by) fangLinien.push({ y, art: by[1] });
    return [x, y];
  }
  function fangLinienSvg(kk) {
    if (!fangLinien.length) return "";
    const B = blattMass(z), W = B.w / kk, H = B.h / kk;
    return '<g class="fang" style="stroke-width:' + r2(0.3 / kk) + '">' + fangLinien.map(f => f.x != null ? '<path d="M' + f.x + " 0V" + H + '"/>' : '<path d="M0 ' + f.y + "H" + W + '"/>').join("") + "</g>" +
      fangLinien.map(f => '<text class="fang-t" x="' + r2((f.x ?? 0) + 1.5 / kk) + '" y="' + r2((f.y ?? 0) - 1.5 / kk + (f.y == null ? 18 / kk : 0)) + '" font-size="' + r2(3 / kk) + '"' + (f.y != null ? ' dx="' + r2(28 / kk) + '"' : "") + ">" + esc(f.art === "Mitte" ? "Mitte" : f.art === "Kante" ? "Kante" : "wie Bohrung") + "</text>").join("");
  }

  /* ---- Zeichnen ---- */
  function malen() {
    const kk = k(); EINH = z.einheit || "mm";
    let w, h, vb;
    if (modus === "bauplan") { const B = blattMass(z); vb = [0, 0, B.w, B.h]; w = B.w * zoom; h = B.h * zoom; }
    else { const b = grenzen(z); vb = [Math.min(0, b.x - 100), Math.min(0, b.y - 100), Math.max(1200, b.x + b.w + 300), Math.max(800, b.y + b.h + 300)]; vb[2] -= vb[0]; vb[3] -= vb[1]; w = vb[2] * zoom; h = vb[3] * zoom; }
    svg.setAttribute("viewBox", vb.join(" ")); svg.setAttribute("width", w); svg.setAttribute("height", h); svg.style.width = w + "px"; svg.style.height = h + "px";
    let o = "<style>" + STIL + (modus === "bauplan" ? "path,rect,circle{stroke-width:.35}" : "") + "</style>";
    if (modus === "bauplan") o += blattSvg(z, raster).h;
    else { o += '<rect x="' + vb[0] + '" y="' + vb[1] + '" width="' + vb[2] + '" height="' + vb[3] + '" fill="#fff" stroke="none"/>'; if (raster) o += '<g class="raster" style="stroke-width:.8">' + punkteRaster(vb) + "</g>"; if (z.titel) { const b = grenzen(z); o += T(b.x, b.y - 8, z.titel, 'font-size="16" font-weight="600"'); } }
    o += '<g transform="scale(' + kk + ')">';
    for (const e of z.el) {
      const inhalt = e.punkte ? linieSvg(e, kk, modus) : elementSvg(e, kk);
      const tp = e.punkte && e.typ === "mass" ? massTrefferPunkte(e) : e.punkte;
      const treff = e.punkte ? '<path d="M' + tp.map(q => q.join(" ")).join("L") + '" class="treffer" style="stroke-width:' + (modus === "bauplan" ? 3 / kk : 10) + '"/>' : trefferFlaeche(e, kk);
      o += '<g data-id="' + e.id + '" class="teil' + (e.id === auswahl ? " gewaehlt" : "") + '">' + treff + inhalt + "</g>";
    }
    // Hilfslinien für die Ansichten: Kanten des gewählten Teils über das ganze Blatt verlängert (werden nicht gedruckt)
    if (modus === "bauplan" && z.hilfslinien !== false) {
      const g2 = z.el.find(e => e.id === auswahl && !e.punkte && e.typ !== "text");
      if (g2) { const B = blattMass(z), W = B.w / kk, H = B.h / kk, bm = g2.typ === "bohrung" ? bohrMass(g2) : null, xs = bm ? [g2.x - bm.rx, g2.x, g2.x + bm.rx] : [g2.x, g2.x + g2.w], ys = bm ? [g2.y - bm.ry, g2.y, g2.y + bm.ry] : [g2.y, g2.y + g2.h];
        o += '<g class="ansicht-hilfe" style="stroke-width:' + r2(0.2 / kk) + ";stroke-dasharray:" + r2(2 / kk) + " " + r2(1.5 / kk) + '">' + xs.map(x2 => '<path d="M' + x2 + " 0V" + H + '"/>').join("") + ys.map(y2 => '<path d="M0 ' + y2 + "H" + W + '"/>').join("") + "</g>"; }
    }
    if (modus === "bauplan") {
      if (geist) { const ge = Object.assign({ typ: "bohrung", d: SYM.bohrung.d, mitte: true }, geist); o += '<g class="geist" transform="translate(' + geist.x + " " + geist.y + ')">' + bohrSvg(ge, kk) + "</g>"; }
      if (geist || (ziehen && ziehen.bewegt)) o += fangLinienSvg(kk);
    }
    // Anschlüsse zeigen, wenn man Linien zieht
    if (LINIEN[werkzeug] || (ziehen && ziehen.griff != null)) for (const e of z.el) if (!e.punkte) for (const q of anschluesse(e)) o += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="' + (modus === "bauplan" ? 0.8 / kk : 3.5) + '" class="anschluss"/>';
    // Griffe an der gewählten Linie
    const g = z.el.find(e => e.id === auswahl); if (g && g.punkte) g.punkte.forEach((q, i) => { o += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="' + (modus === "bauplan" ? 1.4 / kk : 5) + '" class="griff" data-griff="' + i + '"/>'; });
    if (entwurf) { const vorl = Object.assign({}, entwurf, { punkte: [...entwurf.punkte, entwurf.maus || entwurf.punkte[entwurf.punkte.length - 1]] }); if (entwurf.typ === "mass" && entwurf.punkte.length === 2 && entwurf.maus) { vorl.punkte = entwurf.punkte; vorl.abstand = abstandAus(entwurf.punkte, entwurf.maus); } o += '<g class="entwurf">' + linieSvg(vorl, kk, modus) + (vorl.punkte.length >= 2 ? "" : "") + "</g>"; }
    o += "</g>";
    svg.innerHTML = o;
    box.querySelector(".z-zoom").textContent = Math.round(zoom * (modus === "bauplan" ? 100 / 3.2 : 100)) + " %";
    if (!eigenschaftenAus) eigenschaften();
    if (modus === "bauplan") { const ok = passtAufsBlatt(); fuss.classList.toggle("warnung", !ok); if (!ok) fuss.innerHTML = '⚠ Die Zeichnung ist größer als das Blatt oder liegt auf dem Schriftfeld. <button type="button" class="pill klein" id="zFit2">📐 EINPASSEN</button>'; else if (fuss.querySelector("#zFit2")) fussText(); const f2 = fuss.querySelector("#zFit2"); if (f2) f2.onclick = einpassen; }
  }
  // Klickfläche eines Maßes = die Maßlinie selbst (nicht die Verbindung der Messpunkte, die oft über Bohrungen läuft)
  function massTrefferPunkte(e) {
    const [p1, p2] = e.punkte;
    if (e.richtung === "h") return [[p1[0], e.lage], [p2[0], e.lage]];
    if (e.richtung === "v") return [[e.lage, p1[1]], [e.lage, p2[1]]];
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1], L = Math.hypot(dx, dy) || 1, a = e.abstand ?? 10, nx = -dy / L * a, ny = dx / L * a;
    return [[p1[0] + nx, p1[1] + ny], [p2[0] + nx, p2[1] + ny]];
  }
  function punkteRaster(vb) { let s = ""; const st = 20; for (let x = Math.ceil(vb[0] / st) * st; x < vb[0] + vb[2]; x += st) s += '<path d="M' + x + " " + vb[1] + "V" + (vb[1] + vb[3]) + '"/>'; for (let y = Math.ceil(vb[1] / st) * st; y < vb[1] + vb[3]; y += st) s += '<path d="M' + vb[0] + " " + y + "H" + (vb[0] + vb[2]) + '"/>'; return s; }
  function trefferFlaeche(e, kk) {
    const s = SYM[e.typ];
    if (e.typ === "bohrung") { const { rx, ry } = bohrMass(e); return '<rect x="' + r2(e.x - Math.max(rx, 2)) + '" y="' + r2(e.y - Math.max(ry, 2)) + '" width="' + r2(2 * Math.max(rx, 2)) + '" height="' + r2(2 * Math.max(ry, 2)) + '" rx="' + Math.min(Math.max(rx, 2), Math.max(ry, 2)) + '" class="treffer f"/>'; }
    if (e.typ === "text") { const g = (e.groesse || 14) / kk; return '<rect x="' + e.x + '" y="' + (e.y - g) + '" width="' + Math.max(10, String(e.text || "Text").length * g * 0.6) + '" height="' + g * 1.3 + '" class="treffer f"/>'; }
    if (e.typ === "knoten") return '<circle cx="' + e.x + '" cy="' + e.y + '" r="7" class="treffer f"/>';
    const w = e.w ?? s.w, h = e.h ?? s.h;
    if (s.modus === "bauplan") return '<rect x="' + e.x + '" y="' + e.y + '" width="' + w + '" height="' + h + '" class="treffer' + (e.typ === "platte" ? "" : " f") + '" style="stroke-width:' + 3 / kk + '"/>';
    return '<g transform="translate(' + e.x + " " + e.y + ")" + (e.rot ? " rotate(" + e.rot + " " + w / 2 + " " + h / 2 + ")" : "") + '"><rect x="-4" y="-4" width="' + (w + 8) + '" height="' + (h + 8) + '" class="treffer f"/></g>';
  }
  function abstandAus([p1, p2], m) { const dx = p2[0] - p1[0], dy = p2[1] - p1[1], L = Math.hypot(dx, dy) || 1; return r2(((m[0] - p1[0]) * -dy + (m[1] - p1[1]) * dx) / L); }

  /* ---- Technische Zeichnung: passt sie aufs Blatt? ---- */
  const nutz = () => { const B = blattMass(z); return { x0: 25, y0: 15, x1: B.w - 15, y1: B.h - 42, w: B.w, h: B.h }; };   // Innenbereich des Rahmens über dem Schriftfeld (mm auf dem Papier)
  function bauBox() {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; const n = (x, y) => { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); };
    for (const e of z.el) {
      if (e.punkte && e.richtung) { e.punkte.forEach(p => n(p[0], p[1])); if (e.richtung === "h") { n(e.punkte[0][0], e.lage - 6); n(e.punkte[1][0], e.lage + 3); } else { n(e.lage - 6, e.punkte[0][1]); n(e.lage + 3, e.punkte[1][1]); } }
      else if (e.punkte) { e.punkte.forEach(p => n(p[0], p[1])); if (e.typ === "mass" && e.punkte.length === 2) { const [p1, p2] = e.punkte, L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1, nx = -(p2[1] - p1[1]) / L, ny = (p2[0] - p1[0]) / L, ab = (e.abstand ?? 10) + Math.sign(e.abstand ?? 10) * 6; n(p1[0] + nx * ab, p1[1] + ny * ab); n(p2[0] + nx * ab, p2[1] + ny * ab); } }
      else if (e.typ === "bohrung") { const { rx, ry } = bohrMass(e); n(e.x - rx - 3, e.y - ry - 3); n(e.x + rx + 3, e.y + ry + 3); if (e.dmass) n(e.x + rx + 25, e.y - ry - 8); }
      else if (e.typ === "text") { n(e.x, e.y - 6); n(e.x + String(e.text || "").length * (e.groesse || 5) * 0.6, e.y); }
      else n(e.x, e.y), n(e.x + (e.w || 0), e.y + (e.h || 0));
    }
    return a === Infinity ? null : { x: a, y: b, w: c - a, h: d - b };
  }
  function passtAufsBlatt() { const b = bauBox(); if (!b) return true; const kk = k(), N = nutz(); return b.x * kk >= N.x0 - 5 && b.y * kk >= N.y0 - 5 && (b.x + b.w) * kk <= N.w - 10 && (b.y + b.h) * kk <= N.h - 10 && !((b.x + b.w) * kk > N.w - 190 && (b.y + b.h) * kk > N.h - 38); }
  function einpassen() {
    const b = bauBox(); if (!b) { toast("Erst etwas zeichnen."); return; }
    const NUTZ = nutz(), W = NUTZ.x1 - NUTZ.x0, H = NUTZ.y1 - NUTZ.y0, noetig = Math.min(W / b.w, H / b.h);
    const STUFEN = [[2, "2:1"], [1, "1:1"], [0.5, "1:2"], [0.4, "1:2,5"], [0.2, "1:5"], [0.1, "1:10"], [0.05, "1:20"]];
    const [kk, text] = STUFEN.find(([f]) => f <= noetig) || STUFEN[STUFEN.length - 1];
    z.schriftfeld = z.schriftfeld || {}; z.schriftfeld.massstab = text;
    // in die Mitte des freien Bereichs schieben (in echten mm)
    const zielX = (NUTZ.x0 + (W - b.w * kk) / 2) / kk, zielY = (NUTZ.y0 + (H - b.h * kk) / 2) / kk, dx = r2(zielX - b.x), dy = r2(zielY - b.y);
    for (const e of z.el) { if (e.punkte) { e.punkte = e.punkte.map(p => [r2(p[0] + dx), r2(p[1] + dy)]); if (e.richtung) e.lage = r2(e.lage + (e.richtung === "h" ? dy : dx)); } else { e.x = r2(e.x + dx); e.y = r2(e.y + dy); } }
    merken(); malen(); toast("Maßstab " + text + " – die Zeichnung passt jetzt aufs Blatt.");
  }

  /* ---- Eigenschaften rechts ---- */
  function eigenschaften() {
    const e = z.el.find(x => x.id === auswahl), ziel = box.querySelector(".z-eig");
    if (!e) { ziel.innerHTML = '<h3>Eigenschaften</h3><p class="leise">Nichts ausgewählt.</p>'; extra(); return; }
    const def = SYM[e.typ] || LINIEN[e.typ];
    let felder = e.typ === "mass" && e.richtung ? [["lage", "Lage der Maßlinie (" + (e.richtung === "h" ? "Y" : "X") + ")", "laenge"], ["text", "Maßzahl selbst eintragen (leer = gemessen)"]] : def.felder || [];
    if (typeof felder === "function") felder = felder(e);
    ziel.innerHTML = "<h3>" + esc(def.name) + "</h3>" + felder.map(([k2, label, art, opt]) => '<label class="z-feld"><span>' + esc(label) + "</span>" +
      (art === "lang" ? '<textarea data-f="' + k2 + '" rows="2">' + esc(e[k2] ?? (SYM[e.typ] && SYM[e.typ].form ? "" : "")) + "</textarea>"
        : art === "janein" ? '<input type="checkbox" data-f="' + k2 + '"' + (e[k2] !== false && (e[k2] || k2 === "mitte") ? " checked" : "") + ">"
        : art === "wahl" ? '<select data-f="' + k2 + '">' + opt.map(([v, t]) => '<option value="' + v + '"' + ((e[k2] || opt[0][0]) === v ? " selected" : "") + ">" + esc(t) + "</option>").join("") + "</select>"
        : art === "laenge" ? '<span class="z-mass"><input data-f="' + k2 + '" inputmode="decimal" value="' + esc(e[k2] == null ? "" : masszahl(e[k2])) + '"><i>' + EINH + "</i></span>"
        : '<input data-f="' + k2 + '" ' + (art === "zahl" ? 'type="number" step="any"' : "") + ' value="' + esc(e[k2] ?? "") + '">') + "</label>").join("") +
      (e.typ === "mass" ? '<p class="leise">Gemessen: ' + masszahl(e.richtung === "h" ? Math.abs(e.punkte[1][0] - e.punkte[0][0]) : e.richtung === "v" ? Math.abs(e.punkte[1][1] - e.punkte[0][1]) : Math.hypot(e.punkte[1][0] - e.punkte[0][0], e.punkte[1][1] - e.punkte[0][1])) + " " + EINH + "</p>" : "") +
      (!e.punkte && SYM[e.typ].pins ? '<p class="leise">Tipp: Leitungen rasten an den Anschlüssen ein.</p>' : "");
    ziel.querySelectorAll("[data-f]").forEach(f => {
      const art = (felder.find(x => x[0] === f.dataset.f) || [])[2];
      if (art === "laenge") {
        // erst übernehmen, wenn die Eingabe eine gültige Zahl ist (Komma geht auch, „cm“/„mm“ dahinter auch)
        const nehmen = (endgueltig) => {
          const v = laengeLesen(f.value);
          if (!Number.isFinite(v)) { f.classList.toggle("falsch", f.value.trim() !== ""); if (endgueltig) { f.value = e[f.dataset.f] == null ? "" : masszahl(e[f.dataset.f]); f.classList.remove("falsch"); } return; }
          f.classList.remove("falsch");
          if (["w", "h", "d"].includes(f.dataset.f) && !(v > 0)) return;
          e[f.dataset.f] = v; malenOhneEig(); if (endgueltig) { f.value = masszahl(v); merken(); }
        };
        f.oninput = () => nehmen(false); f.onchange = () => nehmen(true); f.onblur = () => nehmen(true);
        f.onkeydown = (ev) => { if (ev.key === "Enter") { nehmen(true); f.blur(); } };
        return;
      }
      f.onchange = f.oninput = () => {
        const vorher = JSON.parse(JSON.stringify(e));
        const v = art === "janein" ? f.checked : art === "zahl" ? (f.value === "" ? undefined : Number(f.value)) : f.value;
        if (v === undefined) delete e[f.dataset.f]; else e[f.dataset.f] = v;
        if (art === "zahl" && ["w", "h", "d"].includes(f.dataset.f) && !(v > 0)) e[f.dataset.f] = f.dataset.f === "d" ? 1 : 10;
        if (f.dataset.f === "text" && e.typ === "mass" && !f.value) delete e.text;
        if (f.dataset.f === "ansicht" && SYM[e.typ] && SYM[e.typ].brett) { if (v === "alt") { e.ansicht = vorher.ansicht; f.value = "alt"; return; } e.v = 2; Object.assign(e, brettMasse(e)); pinsUmhaengen(vorher, e); malen(); merken(); return; }
        if (f.dataset.f === "gepolt") pinsUmhaengen(vorher, e, true);
        if (e.typ === "bohrung" && (f.dataset.f === "art" || f.dataset.f === "richtung")) {
          if (e.art === "senk" && !e.senkD) e.senkD = r2(e.d * 2); if (e.art === "langloch" && !e.laenge) e.laenge = 10; if (e.art === "gewinde" && e.d > 12) e.d = 3;
          if (e.art === "gewinde" || e.art === "senk") e.dmass = true;
          malen(); merken(); return; }
        malenOhneEig(); if (f.type !== "text" && f.tagName !== "TEXTAREA") merken();
      };
      f.onblur = () => merken();
    });
    if (modus === "bauplan") lageBereich(e, ziel);
    extra();
  }

  /* ---- Lage auf der Platte, Mitte, Bemaßen und Lochmuster ---- */
  function lageBereich(e, ziel) {
    const div = document.createElement("div"); div.className = "z-lage";
    if (e.typ === "platte") {
      div.innerHTML = '<h3>Löcher</h3><button type="button" class="pill hell klein" data-l="ecken">⊞ Löcher in alle 4 Ecken …</button>';
      ziel.appendChild(div); div.querySelector('[data-l="ecken"]').onclick = () => eckLoecher(e); return;
    }
    if (e.typ !== "bohrung" && e.typ !== "ausschnitt") return;
    const c = e.typ === "bohrung" ? [e.x, e.y] : [e.x + e.w / 2, e.y + e.h / 2], P = bezugsPlatte(c);
    if (!P) { div.innerHTML = '<h3>Lage auf der Platte</h3><p class="leise">Setz ' + (e.typ === "bohrung" ? "die Bohrung" : "den Ausschnitt") + ' auf eine Platte, dann kannst du die Abstände zu den Plattenkanten eingeben.</p>'; ziel.appendChild(div); return; }
    // Bezug: bei der Bohrung die Mitte, beim Ausschnitt die linke obere Ecke
    const bx = e.typ === "bohrung" ? e.x : e.x, by = e.typ === "bohrung" ? e.y : e.y;
    const re = r2(P.x + P.w - (e.typ === "bohrung" ? e.x : e.x + e.w)), un = r2(P.y + P.h - (e.typ === "bohrung" ? e.y : e.y + e.h));
    const wort = e.typ === "bohrung" ? "Mitte" : "Kante";
    div.innerHTML = '<h3>Lage auf der Platte</h3>' +
      '<label class="z-feld"><span>' + wort + ' von linker Plattenkante</span><span class="z-mass"><input data-r="x" inputmode="decimal" value="' + masszahl(bx - P.x) + '"><i>' + EINH + '</i></span></label>' +
      '<label class="z-feld"><span>' + wort + ' von oberer Plattenkante</span><span class="z-mass"><input data-r="y" inputmode="decimal" value="' + masszahl(by - P.y) + '"><i>' + EINH + '</i></span></label>' +
      '<p class="leise">Bis rechts: ' + masszahl(re) + " " + EINH + " · bis unten: " + masszahl(un) + " " + EINH + "</p>" +
      '<div class="z-knoepfe"><button type="button" class="pill hell klein" data-l="mitte">⊕ In die Mitte</button><button type="button" class="pill hell klein" data-l="mh">↔ Waagerecht mittig</button><button type="button" class="pill hell klein" data-l="mv">↕ Senkrecht mittig</button>' +
      (e.typ === "bohrung" ? '<button type="button" class="pill hell klein" data-l="mass">📏 Abstände bemaßen</button><button type="button" class="pill hell klein" data-l="reihe">⋯ Lochreihe …</button>' : "") + "</div>";
    ziel.appendChild(div);
    div.querySelectorAll("[data-r]").forEach(f => {
      const nehmen = () => { const v = laengeLesen(f.value); if (!Number.isFinite(v)) { f.classList.add("falsch"); return; } f.classList.remove("falsch"); if (f.dataset.r === "x") e.x = r2(P.x + v); else e.y = r2(P.y + v); malenOhneEig(); };
      f.oninput = nehmen; f.onchange = () => { nehmen(); merken(); malen(); }; f.onkeydown = (ev) => { if (ev.key === "Enter") { f.blur(); } };
    });
    const mitte = (h, v) => { if (h) e.x = r2(P.x + P.w / 2 - (e.typ === "bohrung" ? 0 : e.w / 2)); if (v) e.y = r2(P.y + P.h / 2 - (e.typ === "bohrung" ? 0 : e.h / 2)); merken(); malen(); };
    div.querySelector('[data-l="mitte"]').onclick = () => mitte(true, true);
    div.querySelector('[data-l="mh"]').onclick = () => mitte(true, false);
    div.querySelector('[data-l="mv"]').onclick = () => mitte(false, true);
    const ms = div.querySelector('[data-l="mass"]'); if (ms) ms.onclick = () => { abstaendeBemassen([e], P); merken(); malen(); toast("Abstände von der linken und oberen Plattenkante eingezeichnet. Einzelne Maße kannst du verschieben oder löschen."); };
    const rh = div.querySelector('[data-l="reihe"]'); if (rh) rh.onclick = () => lochReihe(e, P);
  }
  // Maße von der linken und oberen Plattenkante zur Bohrungsmitte (nach Norm von einer Bezugskante aus)
  function abstaendeBemassen(loecher, P) {
    // als Kettenmaß: Kante → 1. Loch → 2. Loch … auf einer gemeinsamen Maßlinie (spart Platz)
    const belegt = (r, lage) => z.el.some(m => m.typ === "mass" && m.richtung === r && Math.abs(m.lage - lage) < 3);
    const kette = (r, werte, quer) => {
      const w = [...new Set(werte.map(r2))].sort((a, b) => a - b), start = r === "h" ? P.x : P.y; if (!w.length) return;
      let lage = r2((r === "h" ? P.y : P.x) - 8); while (belegt(r, lage)) lage = r2(lage - 7);
      let vor = start;
      for (const v of w) { if (Math.abs(v - vor) < 0.01) continue; const q = quer(v);
        z.el.push({ id: neueId(), typ: "mass", richtung: r, lage, punkte: r === "h" ? [[vor, vor === start ? P.y : q], [v, q]] : [[vor === start ? P.x : q, vor], [q, v]] }); vor = v; }
    };
    kette("h", loecher.map(b => b.x), (x) => loecher.find(b => r2(b.x) === r2(x)).y);
    kette("v", loecher.map(b => b.y), (y) => loecher.find(b => r2(b.y) === r2(y)).x);
  }
  // kleiner Eingabe-Dialog (prompt() gibt es in Electron nicht)
  function frageDialog(titel, felder, text) {
    return new Promise((fertig) => {
      const d = document.createElement("dialog"); d.className = "dialog";
      d.innerHTML = "<h2>" + esc(titel) + "</h2>" + (text ? '<p class="leise">' + esc(text) + "</p>" : "") + felder.map(([k2, l, wert, art]) => '<label class="z-feld breit"><span>' + esc(l) + "</span>" +
        (art === "wahl" ? '<select data-q="' + k2 + '">' + wert.map(([v, tt]) => '<option value="' + v + '">' + esc(tt) + "</option>").join("") + "</select>" : art === "janein" ? '<input type="checkbox" data-q="' + k2 + '"' + (wert ? " checked" : "") + ">" : '<input data-q="' + k2 + '" value="' + esc(wert) + '">') + "</label>").join("") +
        '<div class="dialog-fuss"><button type="button" class="pill hell" data-ab>Abbrechen</button><button type="button" class="pill" data-ok>OK</button></div>';
      box.appendChild(d); d.showModal();
      const zu = (w) => { d.close(); d.remove(); fertig(w); };
      d.querySelector("[data-ab]").onclick = () => zu(null);
      d.oncancel = (ev) => { ev.preventDefault(); zu(null); };
      d.querySelector("[data-ok]").onclick = () => { const w = {}; d.querySelectorAll("[data-q]").forEach(i => { w[i.dataset.q] = i.type === "checkbox" ? i.checked : i.value; }); zu(w); };
      d.querySelectorAll("input").forEach(i => i.onkeydown = (ev) => { if (ev.key === "Enter") { ev.preventDefault(); d.querySelector("[data-ok]").click(); } });
    });
  }
  async function eckLoecher(P) {
    const w = await frageDialog("Löcher in alle 4 Ecken", [["d", "Durchmesser", masszahl(3.5)], ["rand", "Abstand der Lochmitte von der Kante", masszahl(5)], ["mass", "Abstände bemaßen", true, "janein"]], "Zum Beispiel für Schrauben an einem Gehäusedeckel.");
    if (!w) return;
    const d = laengeLesen(w.d), a = laengeLesen(w.rand);
    if (!(d > 0) || !(a > 0) || 2 * a >= Math.min(P.w, P.h)) { toast("Bitte gültige Werte eingeben – der Randabstand muss kleiner als die halbe Plattenbreite sein."); return; }
    const neu = [[P.x + a, P.y + a], [P.x + P.w - a, P.y + a], [P.x + a, P.y + P.h - a], [P.x + P.w - a, P.y + P.h - a]].map(([x, y]) => ({ id: neueId(), typ: "bohrung", x: r2(x), y: r2(y), d }));
    z.el.push(...neu); neu[0].dmass = true;
    if (w.mass) abstaendeBemassen(neu, P);
    merken(); malen(); toast("4 Bohrungen gesetzt.");
  }
  async function lochReihe(b, P) {
    const w = await frageDialog("Lochreihe", [["n", "Anzahl Löcher insgesamt", "4"], ["ab", "Abstand von Mitte zu Mitte", masszahl(10)], ["r", "Richtung", [["r", "nach rechts →"], ["u", "nach unten ↓"], ["l", "nach links ←"], ["o", "nach oben ↑"]], "wahl"], ["mass", "Abstände bemaßen", false, "janein"]], "Die gewählte Bohrung ist das erste Loch. Die neuen Löcher bekommen denselben Durchmesser.");
    if (!w) return;
    const n = Math.round(Number(String(w.n).replace(",", "."))), ab = laengeLesen(w.ab);
    if (!(n >= 2 && n <= 60) || !(ab > 0)) { toast("Bitte 2 bis 60 Löcher und einen Abstand größer als 0 eingeben."); return; }
    const [dx, dy] = { r: [1, 0], u: [0, 1], l: [-1, 0], o: [0, -1] }[w.r];
    const neu = [];
    for (let i = 1; i < n; i++) { const c = JSON.parse(JSON.stringify(b)); c.id = neueId(); c.x = r2(b.x + dx * ab * i); c.y = r2(b.y + dy * ab * i); c.dmass = false; neu.push(c); }
    z.el.push(...neu);
    if (w.mass) abstaendeBemassen([b, ...neu], P);
    merken(); malen(); toast(n + " Löcher in einer Reihe." + (neu.some(c => !bezugsPlatte([c.x, c.y])) ? " Achtung: Einige liegen außerhalb der Platte." : ""));
  }
  function malenOhneEig() { eigenschaftenAus = true; malen(); eigenschaftenAus = false; extra(); }
  function extra() {
    const x = box.querySelector(".z-extra");
    if (modus !== "schaltplan") { x.innerHTML = modus === "bauplan" ? '<h3>Einheit und Raster</h3><label class="z-feld"><span>Maße eingeben und anzeigen in</span><select id="zE"><option value="mm">mm (wie in der Norm)</option><option value="cm">cm</option></select></label><label class="z-feld"><span>Einrasten alle</span><select id="zR"><option value="0.5">0,5 mm</option><option value="1">1 mm</option><option value="5">5 mm (0,5 cm)</option><option value="10">10 mm (1 cm)</option></select></label>' +
        '<h3>Blatt</h3><label class="z-feld"><span>Blattgröße</span><select id="zB"><option value="A4">A4 quer</option><option value="A3">A3 quer (für große Teile)</option></select></label><label class="check"><input type="checkbox" id="zH"' + (z.hilfslinien !== false ? " checked" : "") + '> Hilfslinien für Ansichten</label><p class="leise">Maßstab jetzt: <b>' + esc((z.schriftfeld && z.schriftfeld.massstab) || "1:1") + '</b></p><button type="button" class="pill hell klein" id="zFit">📐 AUFS BLATT EINPASSEN</button><p class="leise">Wählt den passenden Maßstab (1:1, 1:2, 1:5 …) und schiebt die Zeichnung in den Rahmen. Die Maßzahlen bleiben die echten Maße. Du kannst auch „12,5 cm“ oder „120 mm“ eintippen. Beim Drucken „Tatsächliche Größe / 100 %“ wählen.</p>' : '<p class="leise">Symbole nach DIN 66001. Tipp: Verzweigung hat zwei Ausgänge – beschrifte die Pfeile mit „ja“ und „nein“.</p>';
      const r = x.querySelector("#zR"); if (r) { r.value = String(z.raster || 1); r.onchange = () => { z.raster = Number(r.value); merken(); }; }
      const ei = x.querySelector("#zE"); if (ei) { ei.value = z.einheit || "mm"; ei.onchange = () => { z.einheit = ei.value; if (ei.value === "cm" && (z.raster || 1) < 5) z.raster = 5; merken(); malen(); }; }
      const fit = x.querySelector("#zFit"); if (fit) fit.onclick = einpassen;
      const bl = x.querySelector("#zB"); if (bl) { bl.value = z.blatt || "A4"; bl.onchange = () => { z.blatt = bl.value; einpassenFenster(); merken(); malen(); }; }
      const hl = x.querySelector("#zH"); if (hl) hl.onchange = () => { z.hilfslinien = hl.checked; merken(); malen(); };
      return; }
    const imCode = pinsAusCode(code ? code() : ""), imPlan = verbundenePins(z), hatUno = z.el.some(e => BRETTER.has(e.typ));
    let h = "<h3>Pins: Code ↔ Plan</h3>";
    if (!hatUno) h += '<p class="leise">Setz einen Arduino ein, dann vergleicht das Programm hier, ob die Pins aus deinem Code im Plan verbunden sind.</p>';
    else {
      h += imCode.length ? '<table class="z-pins">' + imCode.map(p => "<tr><td><b>" + p.pin + "</b></td><td>" + esc(p.arten.join(", ")) + '<small> · Zeile ' + p.zeilen.join(", ") + "</small></td><td>" + (imPlan.has(p.pin) ? '<span class="ok-z">✔ im Plan</span>' : '<span class="nein-z">✖ fehlt im Plan</span>') + "</td></tr>").join("") + "</table>" : '<p class="leise">In deinem Code wird noch kein Pin benutzt.</p>';
      const nurPlan = [...imPlan].filter(p => /^[AD]\d+$/.test(p) && !imCode.some(c => c.pin === p));
      if (nurPlan.length) h += '<p class="leise">Im Plan verbunden, aber nicht im Code: ' + nurPlan.join(", ") + "</p>";
      h += '<p class="leise">Das ist nur eine Kontrolle – zeichnen musst du selbst.</p>';
    }
    x.innerHTML = h;
  }

  /* ---- Maus ---- */
  let letzterDruck = { t: 0, x: 0, y: 0 };
  svg.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0) return;
    const p = punkt(ev);
    // Doppelklick selbst erkennen (das Bild wird bei jedem Klick neu gezeichnet, dann kommt kein echtes dblclick)
    const doppel = ev.timeStamp - letzterDruck.t < 400 && Math.hypot(ev.clientX - letzterDruck.x, ev.clientY - letzterDruck.y) < 6;
    letzterDruck = { t: ev.timeStamp, x: ev.clientX, y: ev.clientY };
    if (doppel && entwurf && LINIEN[entwurf.typ] && LINIEN[entwurf.typ].viele) { if (entwurf.typ === "kette") { entwurf.punkte = entwurf.punkte.slice(0, -1).length >= 2 && entwurf.zuletzt ? entwurf.punkte.slice(0, -1) : entwurf.punkte; ketteFertig(p); } else fertigLinie(); return; }
    if (werkzeug === "auswahl") {
      const gr = ev.target.closest("[data-griff]");
      if (gr) { ziehen = { griff: Number(gr.dataset.griff), id: auswahl }; svg.setPointerCapture(ev.pointerId); return; }
      const t = ev.target.closest("[data-id]");
      auswahl = t ? t.dataset.id : null;
      if (t) { const e = z.el.find(x => x.id === auswahl); ziehen = { id: auswahl, start: p, orig: JSON.parse(JSON.stringify(e)), bewegt: false }; svg.setPointerCapture(ev.pointerId); }
      malen(); return;
    }
    if (SYM[werkzeug]) {
      const s = SYM[werkzeug], e = { id: neueId(), typ: werkzeug, x: einrasten(p[0] - (s.form && s.modus !== "bauplan" ? s.w / 2 : 0)), y: einrasten(p[1] - (s.form && s.modus !== "bauplan" ? s.h / 2 : 0)) };
      if (s.form) { e.w = s.w; e.h = s.h; }
      if (werkzeug === "bohrung") { e.d = s.d; [e.x, e.y] = achsFang(p); geist = null; fangLinien = []; }
      if (s.brett) { e.v = 2; e.ansicht = "symbol"; Object.assign(e, brettMasse(e)); }
      if (werkzeug === "text") e.text = modus === "bauplan" ? "Draufsicht" : "Text";
      if (werkzeug === "text" && modus === "bauplan") e.groesse = 5;
      z.el.push(e); auswahl = e.id; merken(); werkzeugSetzen("auswahl"); return;
    }
    if (LINIEN[werkzeug]) {
      const f = fang(p);
      if (!entwurf) { entwurf = { id: neueId(), typ: werkzeug, punkte: [f.p], maus: f.p }; malen(); return; }
      if (werkzeug === "mass") {
        if (entwurf.punkte.length === 1) { entwurf.punkte.push(f.p); malen(); return; }
        entwurf.abstand = abstandAus(entwurf.punkte, p); delete entwurf.maus; z.el.push(entwurf); auswahl = entwurf.id; entwurf = null; merken(); malen(); return;
      }
      let q = f.p; const letzte = entwurf.punkte[entwurf.punkte.length - 1];
      if (werkzeug === "kette") { entwurf.zuletzt = q[0] !== letzte[0] || q[1] !== letzte[1]; if (entwurf.zuletzt) entwurf.punkte.push(q); malen(); return; }
      if (LINIEN[werkzeug].viele && !ev.shiftKey && letzte[0] !== q[0] && letzte[1] !== q[1]) entwurf.punkte.push([q[0], letzte[1]]);   // rechtwinklig
      if (q[0] !== letzte[0] || q[1] !== letzte[1]) entwurf.punkte.push(q);
      if (!LINIEN[werkzeug].viele || (f.pin && entwurf.punkte.length > 1)) fertigLinie(); else malen();
    }
  });
  svg.addEventListener("pointermove", (ev) => {
    const p = punkt(ev);
    if (entwurf) { entwurf.maus = entwurf.typ === "mass" && entwurf.punkte.length === 2 ? p : fang(p).p; malen(); return; }
    if (werkzeug === "bohrung" && modus === "bauplan") { const [x, y] = achsFang(p); geist = { x, y }; malen(); return; }
    if (!ziehen) return;
    const e = z.el.find(x => x.id === ziehen.id); if (!e) return;
    if (ziehen.griff != null) { e.punkte[ziehen.griff] = fang(p, e.id).p; malen(); return; }
    const dx = p[0] - ziehen.start[0], dy = p[1] - ziehen.start[1]; if (!ziehen.bewegt && Math.hypot(dx, dy) < (modus === "bauplan" ? 0.5 : 3)) return;
    ziehen.bewegt = true;
    if (e.punkte && e.richtung) { e.lage = einrasten(ziehen.orig.lage + (e.richtung === "h" ? dy : dx)); malen(); return; }
    if (e.punkte) e.punkte = ziehen.orig.punkte.map(q => [einrasten(q[0] + dx), einrasten(q[1] + dy)]);
    else if (e.typ === "bohrung") { [e.x, e.y] = achsFang([ziehen.orig.x + dx, ziehen.orig.y + dy], e.id); }
    else if (e.typ === "ausschnitt") { const [cx, cy] = achsFang([ziehen.orig.x + dx + e.w / 2, ziehen.orig.y + dy + e.h / 2], e.id); e.x = r2(cx - e.w / 2); e.y = r2(cy - e.h / 2); }
    else { e.x = einrasten(ziehen.orig.x + dx); e.y = einrasten(ziehen.orig.y + dy); drahtMitziehen(ziehen.orig, e); }
    malen();
  });
  svg.addEventListener("pointerup", () => { if (ziehen) { ziehen = null; fangLinien = []; merken(); malen(); } });
  svg.addEventListener("pointerleave", () => { if (geist) { geist = null; fangLinien = []; malen(); } });
  svg.addEventListener("dblclick", (ev) => { if (entwurf && entwurf.typ === "kette") { ketteFertig(punkt(ev)); return; } if (entwurf && LINIEN[entwurf.typ].viele) fertigLinie(); });
  // Maßkette in einzelne Maße zerlegen: alle auf derselben Linie (waagerecht oder senkrecht – je nach den ersten beiden Punkten)
  function ketteFertig(maus) {
    const p = entwurf.punkte.filter((q, i, a) => i === 0 || q[0] !== a[i - 1][0] || q[1] !== a[i - 1][1]);
    if (p.length < 2) { toast("Mindestens zwei Punkte anklicken."); return; }
    const h = Math.abs(p[1][0] - p[0][0]) >= Math.abs(p[1][1] - p[0][1]), lage = einrasten(h ? maus[1] : maus[0]);
    const sortiert = p.slice().sort((a, b) => h ? a[0] - b[0] : a[1] - b[1]);
    for (let i = 0; i < sortiert.length - 1; i++) { const a = sortiert[i], b = sortiert[i + 1]; if ((h ? b[0] - a[0] : b[1] - a[1]) < 0.01) continue; z.el.push({ id: neueId(), typ: "mass", richtung: h ? "h" : "v", lage, punkte: [a, b] }); }
    entwurf = null; merken(); malen(); toast("Maßkette mit " + (sortiert.length - 1) + " Maßen.");
  }
  // Leitungen an einem Teil umhängen, wenn sich seine Pins verschieben (z. B. andere Ansicht) – zugeordnet über den Pin-Namen
  function pinsUmhaengen(alt, neu, nachReihenfolge) {
    const schl = (liste) => { const zaehl = {}; return liste.map((q, i) => nachReihenfolge ? String(i) : q[2] + "#" + (zaehl[q[2]] = (zaehl[q[2]] || 0) + 1)); };
    const a = anschluesse(alt), b = anschluesse(neu), ka = schl(a), kb = schl(b);
    for (const l of z.el) if (l.punkte && l.typ === "draht") for (const ende of [0, l.punkte.length - 1]) {
      const alte = l.punkte[ende], i = a.findIndex(q => Math.abs(q[0] - alte[0]) < 0.6 && Math.abs(q[1] - alte[1]) < 0.6); if (i < 0) continue;
      const j = kb.indexOf(ka[i]); if (j < 0) continue;
      const nb = ende === 0 ? 1 : l.punkte.length - 2;
      if (l.punkte.length > 2 && nb > 0 && nb < l.punkte.length - 1) { const n = l.punkte[nb]; if (Math.abs(n[1] - alte[1]) < 0.6) n[1] = b[j][1]; else if (Math.abs(n[0] - alte[0]) < 0.6) n[0] = b[j][0]; }
      l.punkte[ende] = [b[j][0], b[j][1]];
    }
  }
  // hängende Leitungen/Pfeile mitnehmen, wenn ein Teil verschoben wird
  function drahtMitziehen(alt, neu) {
    if (modus === "bauplan") return;
    const a = anschluesse(alt), b = anschluesse(neu);
    for (const l of z.el) if (l.punkte && l.typ !== "mass") for (const ende of [0, l.punkte.length - 1]) {
      const orig = (ziehen.linien || (ziehen.linien = {}))[l.id + ":" + ende] || (ziehen.linien[l.id + ":" + ende] = l.punkte[ende].slice());
      const i = a.findIndex(q => Math.abs(q[0] - orig[0]) < 0.6 && Math.abs(q[1] - orig[1]) < 0.6);
      if (i >= 0) { const nb = ende === 0 ? 1 : l.punkte.length - 2, alte = l.punkte[ende]; l.punkte[ende] = [b[i][0], b[i][1]]; if (l.punkte.length > 2 && nb > 0 && nb < l.punkte.length - 1) { const nachbar = l.punkte[nb]; if (Math.abs(nachbar[1] - alte[1]) < 0.6) nachbar[1] = b[i][1]; else if (Math.abs(nachbar[0] - alte[0]) < 0.6) nachbar[0] = b[i][0]; } }
    }
  }
  function fertigLinie() { if (!entwurf) return; if (entwurf.typ === "kette") { ketteFertig(entwurf.maus || entwurf.punkte[entwurf.punkte.length - 1]); return; } delete entwurf.maus; if (entwurf.punkte.length >= 2) { z.el.push(entwurf); auswahl = entwurf.id; merken(); } entwurf = null; malen(); }

  /* ---- Knöpfe und Tasten ---- */
  function loeschen() { if (!auswahl) return; z.el = z.el.filter(e => e.id !== auswahl); auswahl = null; merken(); malen(); }
  function drehenAus() { const e = z.el.find(x => x.id === auswahl); if (!e || e.punkte || SYM[e.typ].modus !== "schaltplan") { if (e) toast("Nur Schaltplan-Symbole lassen sich drehen."); return; } const alt = JSON.parse(JSON.stringify(e)); e.rot = ((e.rot || 0) + 90) % 360; ziehen = { linien: {} }; drahtMitziehen(alt, e); ziehen = null; merken(); malen(); }
  function verdoppeln() { const e = z.el.find(x => x.id === auswahl); if (!e) return; const n = JSON.parse(JSON.stringify(e)); n.id = neueId(); const d = modus === "bauplan" ? 10 : 20; if (n.punkte) n.punkte = n.punkte.map(q => [q[0] + d, q[1] + d]); else { n.x += d; n.y += d; } z.el.push(n); auswahl = n.id; merken(); malen(); }
  async function exportieren(art) {
    const datei = (name || "projekt").replace(/[^\w-]+/g, "_") + "_" + modus;
    if (!KC) { toast("Exportieren geht nur im PC-Programm."); return; }
    const s = svgText(modus, z);
    let ziel = null;
    if (art === "svg") ziel = await KC.exportSpeichern({ name: datei + ".svg", art: "svg", text: s });
    if (art === "png") ziel = await KC.exportSpeichern({ name: datei + ".png", art: "png", base64: await pngAusSvg(s, modus === "bauplan" ? 3508 : 2400) });
    if (art === "pdf") ziel = await KC.pdfSpeichern({ html: druckHtml(modus, z), name: datei + ".pdf", quer: true });
    if (art === "druck") { await KC.drucken({ html: druckHtml(modus, z) }); return; }
    if (art === "notizen") {
      if (!KC.anNotizen) { toast("Geht erst mit der neuesten Version."); return; }
      const png = await pngAusSvg(s, modus === "bauplan" ? 2480 : 2000);
      const r = await KC.anNotizen({ name: TITEL[modus] + (name ? " – " + name : ""), bild: "data:image/png;base64," + png, fach: "NWT" });
      if (r && r.ok) toast("FIDELIA Notizen öffnet sich im Browser und legt die Zeichnung im Fach NWT ab. Falls nicht: Die Datei liegt auch in Dokumente › Kometenwerk Code › Für Notizen.", 9000);
      return;
    }
    if (ziel) toast("Gespeichert: " + ziel);
  }
  function schriftfeldDialog() {
    const d = document.createElement("dialog"); d.className = "dialog"; const sf = z.schriftfeld || (z.schriftfeld = {});
    const F = [["titel", "Benennung (z. B. Deckplatte Reaktionstester)"], ["name", "Name"], ["klasse", "Klasse / Gruppe"], ["datum", "Datum"], ["massstab", "Maßstab (z. B. 1:1 oder 1:2)"], ["werkstoff", "Werkstoff (z. B. Sperrholz 4 mm)"], ["blatt", "Blatt"], ["nummer", "Zeichnungs-Nr."]];
    d.innerHTML = "<h2>Schriftfeld</h2>" + F.map(([k2, l]) => '<label class="z-feld breit"><span>' + l + '</span><input data-s="' + k2 + '" value="' + esc(sf[k2] || "") + '"></label>').join("") + '<div class="dialog-fuss"><button type="button" class="pill" data-ok>OK</button></div>';
    box.appendChild(d); d.showModal();
    d.querySelector("[data-ok]").onclick = () => { d.querySelectorAll("[data-s]").forEach(i => { sf[i.dataset.s] = i.value.trim(); }); if (sf.massstab && !/^\s*\d+(?:[.,]\d+)?\s*:\s*\d+(?:[.,]\d+)?\s*$/.test(sf.massstab)) toast("Maßstab bitte wie „1:2“ schreiben."); d.close(); d.remove(); merken(); malen(); };
  }
  // prompt() gibt es in Electron nicht – deshalb ein eigener kleiner Dialog
  function titelDialog() {
    const d = document.createElement("dialog"); d.className = "dialog";
    d.innerHTML = '<h2>Überschrift</h2><label class="z-feld breit"><span>Überschrift über der Zeichnung</span><input data-t value="' + esc(z.titel || "") + '"></label><div class="dialog-fuss"><button type="button" class="pill hell" data-ab>Abbrechen</button><button type="button" class="pill" data-ok>OK</button></div>';
    box.appendChild(d); d.showModal();
    const i = d.querySelector("[data-t]"); i.focus(); i.select();
    const ok = () => { z.titel = i.value.trim(); d.close(); d.remove(); merken(); malen(); };
    d.querySelector("[data-ok]").onclick = ok;
    i.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); ok(); } };
    d.querySelector("[data-ab]").onclick = () => { d.close(); d.remove(); };
  }
  const AKT = {
    rueck: () => zurueck(-1), vor: () => zurueck(1), drehen: drehenAus, loeschen, raster: () => { raster = !raster; malen(); },
    "zoom+": () => { zoom *= 1.25; malen(); }, "zoom-": () => { zoom /= 1.25; malen(); },
    sf: schriftfeldDialog, titel: titelDialog,
    png: () => exportieren("png"), svg: () => exportieren("svg"), notizen: () => exportieren("notizen"), pdf: () => exportieren("pdf"), druck: () => exportieren("druck"), zu: schliessen
  };
  box.querySelectorAll(".z-kopf [data-a]").forEach(b => b.onclick = () => AKT[b.dataset.a]());
  function taste(ev) {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || box.querySelector("dialog[open]")) return;
    const strg = ev.ctrlKey || ev.metaKey, t = ev.key.toLowerCase();
    if (ev.key === "Escape") { if (entwurf) { entwurf = null; malen(); } else if (werkzeug !== "auswahl") werkzeugSetzen("auswahl"); else if (auswahl) { auswahl = null; malen(); } ev.preventDefault(); }
    else if (ev.key === "Enter" && entwurf) fertigLinie();
    else if (ev.key === "Delete" || ev.key === "Backspace") { ev.preventDefault(); loeschen(); }
    else if (strg && t === "z") { ev.preventDefault(); zurueck(ev.shiftKey ? 1 : -1); }
    else if (strg && t === "y") { ev.preventDefault(); zurueck(1); }
    else if (strg && t === "d") { ev.preventDefault(); verdoppeln(); }
    else if (!strg && t === "r") drehenAus();
    else if (auswahl && /^Arrow/.test(ev.key)) { ev.preventDefault(); const e = z.el.find(x => x.id === auswahl), s = (ev.shiftKey ? 10 : 1) * (modus === "bauplan" ? (z.raster || 1) : 10), dx = ev.key === "ArrowLeft" ? -s : ev.key === "ArrowRight" ? s : 0, dy = ev.key === "ArrowUp" ? -s : ev.key === "ArrowDown" ? s : 0; if (e.punkte) { e.punkte = e.punkte.map(q => [r2(q[0] + dx), r2(q[1] + dy)]); if (e.richtung) e.lage = r2(e.lage + (e.richtung === "h" ? dy : dx)); } else { const alt = JSON.parse(JSON.stringify(e)); e.x = r2(e.x + dx); e.y = r2(e.y + dy); ziehen = { linien: {} }; drahtMitziehen(alt, e); ziehen = null; } merken(); malen(); }
  }
  document.addEventListener("keydown", taste, true);
  function schliessen() { merken(); document.removeEventListener("keydown", taste, true); box.remove(); }
  // Blatt ganz sichtbar machen (passend zum Fenster)
  const einpassenFenster = () => { const fl = box.querySelector(".z-flaeche"), B = blattMass(z); zoom = Math.max(0.8, Math.min(4, (fl.clientWidth - 44) / B.w, (fl.clientHeight - 44) / B.h)); };
  if (modus === "bauplan") einpassenFenster();
  fussText(); malen();
  return { schliessen, get daten() { return z; } };
}
