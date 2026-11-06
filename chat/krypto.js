/* FIDELIA Chat – Verschlüsselung
   Nur eingebaute Browser-Technik (Web Crypto), nichts Selbstgebautes:
   - Schlüsselpaar ECDH P-256 pro Konto, der geheime Teil verlässt das Gerät nie
     (nur verschlüsselt im Tresor, mit dem Wiederherstellungs-Code)
   - pro Kontakt: ECDH → HKDF-SHA-256 → AES-GCM-256
   - jede Nachricht: zufälliger IV, Absender/Empfänger/Nachrichten-ID als Zusatzdaten
*/
(function () {
  "use strict";
  var S = crypto.subtle, TE = new TextEncoder(), TD = new TextDecoder();
  var K = window.FCK = {};

  function b64(buf) { var b = new Uint8Array(buf), s = ""; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function unb64(s) { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; var r = atob(s), b = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) b[i] = r.charCodeAt(i); return b; }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }
  K.b64 = b64; K.unb64 = unb64; K.hex = hex;

  K.zufall = function (n) { return crypto.getRandomValues(new Uint8Array(n)); };
  K.id = function (bytes) { return hex(K.zufall(bytes || 12)); };          // 24 Hex-Zeichen
  K.token = function () { return b64(K.zufall(15)); };                     // 20 Zeichen für Kontakt-Codes
  K.sha = function (text) { return S.digest("SHA-256", TE.encode(text)).then(hex); };

  // Wiederherstellungs-Code: 20 Zeichen ohne verwechselbare Buchstaben (≈ 100 Bit Zufall)
  var ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  K.neuerCode = function () {
    var z = K.zufall(20), s = "";
    for (var i = 0; i < 20; i++) { s += ABC[z[i] & 31]; if (i % 4 === 3 && i < 19) s += "-"; }
    return s;
  };
  K.codeSauber = function (s) {
    s = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/O/g, "0").replace(/I/g, "1");
    if (s.length !== 20) return null;
    for (var i = 0; i < 20; i++) if (ABC.indexOf(s[i]) < 0) return null;
    return s.match(/.{4}/g).join("-");
  };
  K.tresorName = function (code) { return K.sha("fidelia-chat/tresor/" + code); };
  K.schloss = function (code) { return K.sha("fidelia-chat/schloss/" + code); };

  // Schlüsselpaar
  K.neuesPaar = function () { return S.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]); };
  K.oeffentlich = function (paar) { return S.exportKey("jwk", paar.publicKey).then(function (j) { return j.x + "." + j.y; }); };
  K.fingerabdruck = function (ek) { return S.digest("SHA-256", TE.encode("fidelia-chat/ek/" + ek)).then(function (h) { return hex(h).slice(0, 32); }); };
  function oeffImport(ek) {
    var t = String(ek).split(".");
    return S.importKey("jwk", { kty: "EC", crv: "P-256", x: t[0], y: t[1], ext: true }, { name: "ECDH", namedCurve: "P-256" }, false, []);
  }
  K.privatExport = function (paar) { return S.exportKey("jwk", paar.privateKey); };
  K.privatImport = function (jwk, exportierbar) { return S.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, !!exportierbar, ["deriveBits"]); };

  // Gemeinsamer Schlüssel mit einem Kontakt
  var cache = {};
  K.gemeinsam = function (meinPriv, ichCid, duCid, duEk) {
    var k = duCid + "|" + duEk;
    if (cache[k]) return cache[k];
    cache[k] = oeffImport(duEk).then(function (pub) {
      return S.deriveBits({ name: "ECDH", public: pub }, meinPriv, 256);
    }).then(function (bits) {
      return S.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
    }).then(function (basis) {
      var paar = [ichCid, duCid].sort().join("|");
      return S.deriveKey({ name: "HKDF", hash: "SHA-256", salt: TE.encode("fidelia-chat/v1/" + paar), info: TE.encode("nachrichten") }, basis, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    });
    cache[k].catch(function () { delete cache[k]; });
    return cache[k];
  };

  K.verschluesseln = function (schluessel, obj, zusatz) {
    var iv = K.zufall(12);
    return S.encrypt({ name: "AES-GCM", iv: iv, additionalData: TE.encode(zusatz) }, schluessel, TE.encode(JSON.stringify(obj)))
      .then(function (ct) { return { iv: b64(iv), ct: b64(ct) }; });
  };
  K.entschluesseln = function (schluessel, iv, ct, zusatz) {
    return S.decrypt({ name: "AES-GCM", iv: unb64(iv), additionalData: TE.encode(zusatz) }, schluessel, unb64(ct))
      .then(function (pt) { return JSON.parse(TD.decode(pt)); });
  };

  // Tresor: Konto verschlüsselt mit dem Wiederherstellungs-Code (PBKDF2, viele Runden)
  function codeSchluessel(code, salz) {
    return S.importKey("raw", TE.encode("fidelia-chat/" + code), "PBKDF2", false, ["deriveKey"]).then(function (b) {
      return S.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: salz, iterations: 310000 }, b, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    });
  }
  K.tresorZu = function (code, inhalt) {
    var salz = K.zufall(16), iv = K.zufall(12);
    return codeSchluessel(code, salz).then(function (k) {
      return S.encrypt({ name: "AES-GCM", iv: iv }, k, TE.encode(JSON.stringify(inhalt)));
    }).then(function (ct) { return { s: b64(salz), iv: b64(iv), ct: b64(ct) }; });
  };
  K.tresorAuf = function (code, t) {
    return codeSchluessel(code, unb64(t.s)).then(function (k) {
      return S.decrypt({ name: "AES-GCM", iv: unb64(t.iv) }, k, unb64(t.ct));
    }).then(function (pt) { return JSON.parse(TD.decode(pt)); });
  };

  // Sicherheitsnummer zum Vergleichen (gleich auf beiden Handys)
  K.sicherheitsnummer = function (ekA, ekB) {
    return K.sha("fidelia-chat/sicherheit/" + [ekA, ekB].sort().join("|")).then(function (h) {
      var z = "";
      for (var i = 0; i < 12; i++) { z += String(parseInt(h.substr(i * 4, 4), 16) % 100000).padStart(5, "0"); }
      return z.match(/.{5}/g).join(" ");
    });
  };
})();
