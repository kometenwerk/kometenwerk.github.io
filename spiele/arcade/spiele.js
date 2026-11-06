/* FLARESSA Arcade – die sechs Spiele. Jedes Spiel ist ein Objekt mit start/update/draw und Eingaben.
   Alle Namen, Figuren und Regeln sind eigene Varianten bekannter Spielideen. */
(function () {
  "use strict";
  var SP = window.ARCADE_SPIELE = [];
  function zufall(a, b) { return a + Math.random() * (b - a); }
  function rund(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function sterne(n, W, H) { var s = []; for (var i = 0; i < n; i++) s.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.3, v: Math.random() * 20 + 8 }); return s; }
  function sterneMalen(g, s, W, H, dt) { g.fillStyle = "#fff"; s.forEach(function (p) { p.y += p.v * dt; if (p.y > H) { p.y = 0; p.x = Math.random() * W; } g.globalAlpha = 0.25 + p.r * 0.35; g.fillRect(p.x, p.y, p.r, p.r); }); g.globalAlpha = 1; }

  /* ================= 1. Klötzchen-Komet (fallende Blöcke) ================= */
  var FORMEN = [
    { f: "#22d3ee", z: [[0, 1], [1, 1], [2, 1], [3, 1]] }, { f: "#facc15", z: [[1, 0], [2, 0], [1, 1], [2, 1]] },
    { f: "#a855f7", z: [[1, 0], [0, 1], [1, 1], [2, 1]] }, { f: "#22c55e", z: [[1, 0], [2, 0], [0, 1], [1, 1]] },
    { f: "#ef4444", z: [[0, 0], [1, 0], [1, 1], [2, 1]] }, { f: "#3b82f6", z: [[0, 0], [0, 1], [1, 1], [2, 1]] },
    { f: "#f97316", z: [[2, 0], [0, 1], [1, 1], [2, 1]] }];
  SP.push({
    id: "kloetzchen", name: "Klötzchen-Komet", emoji: "🧱", farbe: "#22d3ee", W: 360, H: 640,
    text: "Dreh und schieb die fallenden Klötzchen. Volle Reihen verschwinden!",
    hilfe: "Tippen = drehen · Wischen links/rechts = schieben · nach unten wischen = fallen lassen. Tastatur: ← → ↑ ↓ Leertaste.",
    start: function (api) { this.api = api; this.feld = []; for (var y = 0; y < 20; y++) this.feld.push(new Array(10).fill(null)); this.punkte = 0; this.reihen = 0; this.stufe = 1; this.takt = 0; this.sack = []; this.naechstes = this.ziehe(); this.neu(); this.blitz = []; },
    ziehe: function () { if (!this.sack.length) { this.sack = [0, 1, 2, 3, 4, 5, 6].sort(function () { return Math.random() - 0.5; }); } return this.sack.pop(); },
    neu: function () { var t = FORMEN[this.naechstes]; this.naechstes = this.ziehe(); this.st = { f: t.f, z: t.z.map(function (p) { return p.slice(); }), x: 3, y: 0, i: t === FORMEN[1] }; if (this.stoss(0, 0, this.st.z)) this.api.ende(this.punkte); },
    stoss: function (dx, dy, z) { var s = this.st; for (var i = 0; i < z.length; i++) { var x = s.x + z[i][0] + dx, y = s.y + z[i][1] + dy; if (x < 0 || x >= 10 || y >= 20) return true; if (y >= 0 && this.feld[y][x]) return true; } return false; },
    drehen: function () { if (this.st.i) return; var z = this.st.z.map(function (p) { return [2 - p[1], p[0]]; }); if (this.st.f === FORMEN[0].f) z = this.st.z.map(function (p) { return [3 - p[1], p[0]]; }); var kicks = [0, -1, 1, -2, 2]; for (var k = 0; k < kicks.length; k++) if (!this.stoss(kicks[k], 0, z)) { this.st.z = z; this.st.x += kicks[k]; this.api.ton("klick"); return; } },
    schieb: function (d) { if (!this.stoss(d, 0, this.st.z)) { this.st.x += d; this.api.ton("tick"); } },
    fallen: function () { var n = 0; while (!this.stoss(0, 1, this.st.z)) { this.st.y++; n++; } this.punkte += n * 2; this.fest(); },
    fest: function () {
      var s = this.st, self = this;
      s.z.forEach(function (p) { if (s.y + p[1] >= 0) self.feld[s.y + p[1]][s.x + p[0]] = s.f; });
      var voll = []; for (var y = 0; y < 20; y++) if (this.feld[y].every(Boolean)) voll.push(y);
      if (voll.length) {
        voll.forEach(function (y) { self.feld.splice(y, 1); self.feld.unshift(new Array(10).fill(null)); });
        this.reihen += voll.length; this.punkte += [0, 100, 300, 500, 800][voll.length] * this.stufe; this.stufe = 1 + Math.floor(this.reihen / 10);
        this.api.ton(voll.length >= 4 ? "jubel" : "punkt"); this.api.wackeln(voll.length * 3);
      } else this.api.ton("tock");
      this.neu();
    },
    update: function (dt) { this.takt += dt; var t = Math.max(0.08, 0.8 - (this.stufe - 1) * 0.07); if (this.takt > t) { this.takt = 0; if (this.stoss(0, 1, this.st.z)) this.fest(); else this.st.y++; } },
    draw: function (g) {
      var Z = 28, ox = 20, oy = 70, self = this;
      g.fillStyle = "#0b1020"; g.fillRect(0, 0, 360, 640);
      g.fillStyle = "rgba(255,255,255,.04)"; g.fillRect(ox, oy, 10 * Z, 20 * Z);
      g.strokeStyle = "rgba(255,255,255,.05)"; for (var x = 0; x <= 10; x++) { g.beginPath(); g.moveTo(ox + x * Z, oy); g.lineTo(ox + x * Z, oy + 20 * Z); g.stroke(); }
      function block(x, y, f, a) { g.globalAlpha = a || 1; g.fillStyle = f; rund(g, ox + x * Z + 1, oy + y * Z + 1, Z - 2, Z - 2, 5); g.fill(); g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(ox + x * Z + 4, oy + y * Z + 4, Z - 12, 4); g.globalAlpha = 1; }
      this.feld.forEach(function (r, y) { r.forEach(function (f, x) { if (f) block(x, y, f); }); });
      var gy = 0; while (!this.stoss(0, gy + 1, this.st.z)) gy++;
      this.st.z.forEach(function (p) { if (self.st.y + p[1] + gy >= 0) block(self.st.x + p[0], self.st.y + p[1] + gy, self.st.f, 0.2); });
      this.st.z.forEach(function (p) { if (self.st.y + p[1] >= 0) block(self.st.x + p[0], self.st.y + p[1], self.st.f); });
      g.fillStyle = "#fff"; g.font = "600 14px 'Space Grotesk',sans-serif"; g.textAlign = "left";
      g.save(); g.font = "600 10px 'Space Grotesk',sans-serif"; g.textAlign = "center"; g.fillStyle = "#a5a8c8"; g.fillText("NÄCHSTES", 330, 80); g.restore();
      g.textAlign = "center"; g.fillText("Stufe " + this.stufe + " · " + this.reihen + " Reihen", 180, 52);
      var n = FORMEN[this.naechstes]; g.save(); g.translate(330, 92); n.z.forEach(function (p) { g.fillStyle = n.f; rund(g, p[0] * 10 - 20, p[1] * 10, 9, 9, 3); g.fill(); }); g.restore();
    },
    tap: function () { this.drehen(); }, wisch: function (r) { if (r === "l") this.schieb(-1); else if (r === "r") this.schieb(1); else if (r === "u") this.fallen(); else if (r === "o") this.drehen(); },
    taste: function (k) { if (k === "ArrowLeft") this.schieb(-1); else if (k === "ArrowRight") this.schieb(1); else if (k === "ArrowUp") this.drehen(); else if (k === "ArrowDown") { if (!this.stoss(0, 1, this.st.z)) { this.st.y++; this.punkte++; } } else if (k === " ") this.fallen(); },
    knoepfe: [["◀", "ArrowLeft"], ["⟳", "ArrowUp"], ["▼", "ArrowDown"], ["⤓", " "], ["▶", "ArrowRight"]]
  });

  /* ================= 2. Sternschlange ================= */
  SP.push({
    id: "schlange", name: "Sternschlange", emoji: "🐍", farbe: "#22c55e", W: 360, H: 640,
    text: "Sammle Sterne und werde immer länger – aber beiß dich nicht selbst!",
    hilfe: "Wischen oder Pfeiltasten zum Lenken. Goldene Sterne geben 5 Punkte.",
    start: function (api) { this.api = api; this.n = 18; this.k = []; for (var i = 0; i < 4; i++) this.k.push({ x: 6 - i, y: 14 }); this.r = { x: 1, y: 0 }; this.naechste = { x: 1, y: 0 }; this.takt = 0; this.punkte = 0; this.stern(); },
    stern: function () { var self = this, p; do { p = { x: Math.floor(Math.random() * this.n), y: Math.floor(Math.random() * 28) }; } while (this.k.some(function (t) { return t.x === p.x && t.y === p.y; })); p.gold = Math.random() < 0.15; this.s = p; },
    lenk: function (x, y) { if (this.r.x === -x && this.r.y === -y) return; this.naechste = { x: x, y: y }; },
    update: function (dt) {
      this.takt += dt; var t = Math.max(0.06, 0.14 - this.k.length * 0.0015); if (this.takt < t) return; this.takt = 0;
      this.r = this.naechste; var kopf = { x: this.k[0].x + this.r.x, y: this.k[0].y + this.r.y };
      if (kopf.x < 0 || kopf.x >= this.n || kopf.y < 0 || kopf.y >= 28 || this.k.some(function (t) { return t.x === kopf.x && t.y === kopf.y; })) { this.api.ton("aua"); this.api.wackeln(8); this.api.ende(this.punkte); return; }
      this.k.unshift(kopf);
      if (kopf.x === this.s.x && kopf.y === this.s.y) { this.punkte += this.s.gold ? 5 : 1; this.api.ton(this.s.gold ? "jubel" : "punkt"); if (this.s.gold) { this.k.push(Object.assign({}, this.k[this.k.length - 1])); } this.stern(); } else this.k.pop();
    },
    draw: function (g) {
      var Z = 19, ox = (360 - this.n * Z) / 2, oy = 60, self = this;
      g.fillStyle = "#06150c"; g.fillRect(0, 0, 360, 640);
      g.fillStyle = "rgba(34,197,94,.07)"; for (var y = 0; y < 28; y++) for (var x = 0; x < this.n; x++) if ((x + y) % 2) g.fillRect(ox + x * Z, oy + y * Z, Z, Z);
      g.strokeStyle = "rgba(34,197,94,.5)"; g.lineWidth = 2; g.strokeRect(ox, oy, this.n * Z, 28 * Z);
      var s = this.s, t = performance.now() / 300; g.save(); g.translate(ox + s.x * Z + Z / 2, oy + s.y * Z + Z / 2); g.rotate(t); g.fillStyle = s.gold ? "#facc15" : "#f0f9ff"; g.beginPath(); for (var i = 0; i < 10; i++) { var w = i * Math.PI / 5, r = i % 2 ? 3.5 : 8.5; g.lineTo(Math.cos(w) * r, Math.sin(w) * r); } g.fill(); g.restore();
      this.k.forEach(function (p, i) { var a = 1 - i / (self.k.length + 6); g.fillStyle = "hsl(" + (140 - i * 2) + ",75%," + (45 + a * 15) + "%)"; rund(g, ox + p.x * Z + 1, oy + p.y * Z + 1, Z - 2, Z - 2, i ? 5 : 8); g.fill(); });
      var k = this.k[0]; g.fillStyle = "#0b1020"; g.beginPath(); g.arc(ox + k.x * Z + Z / 2 + this.r.y * 4 + this.r.x * 3, oy + k.y * Z + Z / 2 - this.r.x * 4 + this.r.y * 3, 2.3, 0, 7); g.arc(ox + k.x * Z + Z / 2 - this.r.y * 4 + this.r.x * 3, oy + k.y * Z + Z / 2 + this.r.x * 4 + this.r.y * 3, 2.3, 0, 7); g.fill();
    },
    wisch: function (r) { if (r === "l") this.lenk(-1, 0); else if (r === "r") this.lenk(1, 0); else if (r === "o") this.lenk(0, -1); else this.lenk(0, 1); },
    taste: function (k) { this.wisch({ ArrowLeft: "l", ArrowRight: "r", ArrowUp: "o", ArrowDown: "u" }[k] || ""); },
    knoepfe: [["◀", "ArrowLeft"], ["▲", "ArrowUp"], ["▼", "ArrowDown"], ["▶", "ArrowRight"]]
  });

  /* ================= 3. Flatterfunke ================= */
  SP.push({
    id: "flatter", name: "Flatterfunke", emoji: "✨", farbe: "#f59e0b", W: 360, H: 640,
    text: "Tipp, damit der kleine Funke fliegt – und schlüpf durch die Asteroiden-Tore.",
    hilfe: "Tippen, klicken oder Leertaste = hochflattern.",
    start: function (api) { this.api = api; this.y = 300; this.v = 0; this.tore = []; this.abst = 0; this.punkte = 0; this.t = 0; this.los = false; this.st = sterne(60, 360, 640); this.funken = []; },
    flattern: function () { this.los = true; this.v = -330; this.api.ton("flap"); for (var i = 0; i < 5; i++) this.funken.push({ x: 90, y: this.y + 8, vx: zufall(-80, -20), vy: zufall(20, 90), l: 0.5 }); },
    update: function (dt) {
      this.t += dt; if (!this.los) { this.y = 300 + Math.sin(this.t * 3) * 8; return; }
      this.v += 980 * dt; this.y += this.v * dt;
      var tempo = 150 + Math.min(90, this.punkte * 3); this.abst -= tempo * dt;
      if (this.abst <= 0) { var luecke = Math.max(140, 190 - this.punkte * 2); this.tore.push({ x: 380, m: zufall(140, 500), l: luecke, gez: false }); this.abst = 210; }
      var self = this;
      this.tore.forEach(function (t) { t.x -= tempo * dt; if (!t.gez && t.x < 70) { t.gez = true; self.punkte++; self.api.ton("punkt"); } });
      this.tore = this.tore.filter(function (t) { return t.x > -80; });
      this.funken.forEach(function (f) { f.x += f.vx * dt; f.y += f.vy * dt; f.l -= dt; }); this.funken = this.funken.filter(function (f) { return f.l > 0; });
      var tot = this.y > 610 || this.y < -20;
      this.tore.forEach(function (t) { if (90 + 14 > t.x && 90 - 14 < t.x + 56 && (self.y - 12 < t.m - t.l / 2 || self.y + 12 > t.m + t.l / 2)) tot = true; });
      if (tot) { this.api.ton("aua"); this.api.wackeln(10); this.api.ende(this.punkte); }
    },
    draw: function (g, dt) {
      var gr = g.createLinearGradient(0, 0, 0, 640); gr.addColorStop(0, "#1e1b4b"); gr.addColorStop(1, "#4c1d95"); g.fillStyle = gr; g.fillRect(0, 0, 360, 640);
      sterneMalen(g, this.st, 360, 640, this.los ? dt * 0.3 : 0);
      this.tore.forEach(function (t) {
        [[0, t.m - t.l / 2], [t.m + t.l / 2, 640]].forEach(function (s) {
          var gg = g.createLinearGradient(t.x, 0, t.x + 56, 0); gg.addColorStop(0, "#57534e"); gg.addColorStop(1, "#a8a29e"); g.fillStyle = gg; rund(g, t.x, s[0], 56, s[1] - s[0], 14); g.fill();
          g.fillStyle = "rgba(0,0,0,.25)"; for (var i = 0; i < 4; i++) { g.beginPath(); g.arc(t.x + 14 + (i % 2) * 24, s[0] + 30 + i * ((s[1] - s[0]) / 4.2), 6, 0, 7); g.fill(); }
        });
      });
      this.funken.forEach(function (f) { g.globalAlpha = f.l * 2; g.fillStyle = "#fde047"; g.fillRect(f.x, f.y, 3, 3); }); g.globalAlpha = 1;
      g.save(); g.translate(90, this.y); g.rotate(Math.max(-0.5, Math.min(1, this.v / 600)));
      g.shadowColor = "#fbbf24"; g.shadowBlur = 20; g.fillStyle = "#fbbf24"; g.beginPath(); g.arc(0, 0, 13, 0, 7); g.fill(); g.shadowBlur = 0;
      g.fillStyle = "#fff7ed"; g.beginPath(); g.ellipse(-4, -4 + Math.sin(this.t * 25) * 3, 9, 5, -0.4, 0, 7); g.fill();
      g.fillStyle = "#1e1b4b"; g.beginPath(); g.arc(5, -3, 2.5, 0, 7); g.fill(); g.restore();
      if (!this.los) { g.fillStyle = "#fff"; g.font = "600 20px 'Space Grotesk',sans-serif"; g.textAlign = "center"; g.fillText("Tippen zum Starten", 180, 420); }
    },
    tap: function () { this.flattern(); }, taste: function (k) { if (k === " " || k === "ArrowUp") this.flattern(); }, wisch: function () { this.flattern(); }
  });

  /* ================= 4. Asteroiden-Abwehr (Invasoren) ================= */
  SP.push({
    id: "abwehr", name: "Sternen-Abwehr", emoji: "🛸", farbe: "#a855f7", W: 360, H: 640,
    text: "Die Glibber-Ufos kommen! Schieb dein Schiff hin und her und verteidige die Station.",
    hilfe: "Wischen/Ziehen oder ← → zum Fahren. Dein Schiff feuert von selbst.",
    start: function (api) { this.api = api; this.x = 180; this.schuss = []; this.feind = []; this.bomben = []; this.welle = 0; this.punkte = 0; this.leben = 3; this.cool = 0; this.st = sterne(70, 360, 640); this.zielX = null; this.neueWelle(); this.funken = []; this.halt = 0; },
    neueWelle: function () { this.welle++; this.feind = []; for (var r = 0; r < 4; r++) for (var c = 0; c < 7; c++) this.feind.push({ x: 40 + c * 44, y: 90 + r * 40, r: r }); this.richt = 1; this.tempo = 26 + this.welle * 8; },
    update: function (dt) {
      var self = this; if (this.halt > 0) { this.halt -= dt; return; }
      if (this.zielX !== null) this.x += Math.max(-420 * dt, Math.min(420 * dt, this.zielX - this.x));
      if (this.links) this.x -= 300 * dt; if (this.rechts) this.x += 300 * dt;
      this.x = Math.max(24, Math.min(336, this.x));
      this.cool -= dt; if (this.cool <= 0) { this.cool = 0.38; this.schuss.push({ x: this.x, y: 560 }); this.api.ton("piu"); }
      this.schuss.forEach(function (s) { s.y -= 520 * dt; }); this.schuss = this.schuss.filter(function (s) { return s.y > 0; });
      var rand = false; this.feind.forEach(function (f) { f.x += self.richt * self.tempo * dt; if (f.x < 18 || f.x > 342) rand = true; });
      if (rand) { this.richt *= -1; this.feind.forEach(function (f) { f.y += 14; f.x += self.richt * 4; }); }
      if (Math.random() < dt * (0.6 + this.welle * 0.25) && this.feind.length) { var f = this.feind[Math.floor(Math.random() * this.feind.length)]; this.bomben.push({ x: f.x, y: f.y + 10 }); }
      this.bomben.forEach(function (b) { b.y += (160 + self.welle * 15) * dt; }); this.bomben = this.bomben.filter(function (b) { return b.y < 650; });
      this.schuss.forEach(function (s) { self.feind.forEach(function (f) { if (!f.weg && Math.abs(s.x - f.x) < 16 && Math.abs(s.y - f.y) < 14) { f.weg = true; s.y = -99; self.punkte += (4 - f.r) * 10; self.api.ton("bumm"); for (var i = 0; i < 8; i++) self.funken.push({ x: f.x, y: f.y, vx: zufall(-120, 120), vy: zufall(-120, 120), l: 0.4, f: ["#f0abfc", "#a855f7", "#22d3ee", "#facc15"][f.r] }); } }); });
      this.feind = this.feind.filter(function (f) { return !f.weg; });
      this.funken.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt; }); this.funken = this.funken.filter(function (p) { return p.l > 0; });
      var getroffen = this.bomben.some(function (b) { return Math.abs(b.x - self.x) < 18 && b.y > 560 && b.y < 600; });
      if (getroffen || this.feind.some(function (f) { return f.y > 540; })) {
        this.leben--; this.bomben = []; this.api.ton("aua"); this.api.wackeln(12); this.halt = 1;
        if (this.leben <= 0 || this.feind.some(function (f) { return f.y > 540; })) { this.api.ende(this.punkte); return; }
      }
      if (!this.feind.length) { this.api.ton("jubel"); this.punkte += 100 * this.welle; this.neueWelle(); this.halt = 1.2; }
    },
    draw: function (g, dt) {
      g.fillStyle = "#070312"; g.fillRect(0, 0, 360, 640); sterneMalen(g, this.st, 360, 640, dt);
      var t = performance.now() / 200, F = ["#f0abfc", "#a855f7", "#22d3ee", "#facc15"];
      this.feind.forEach(function (f) { g.fillStyle = F[f.r]; var w = Math.sin(t + f.x * 0.1) * 2; g.beginPath(); g.ellipse(f.x, f.y, 15, 9 + w * 0.3, 0, 0, 7); g.fill(); g.fillStyle = "rgba(255,255,255,.75)"; g.beginPath(); g.ellipse(f.x, f.y - 6, 7, 6, 0, Math.PI, 0); g.fill(); g.fillStyle = "#0b1020"; g.beginPath(); g.arc(f.x - 5, f.y + 1, 2, 0, 7); g.arc(f.x + 5, f.y + 1, 2, 0, 7); g.fill(); });
      g.fillStyle = "#67e8f9"; this.schuss.forEach(function (s) { rund(g, s.x - 2, s.y - 8, 4, 14, 2); g.fill(); });
      g.fillStyle = "#fb7185"; this.bomben.forEach(function (b) { g.beginPath(); g.arc(b.x, b.y, 4, 0, 7); g.fill(); });
      this.funken.forEach(function (p) { g.globalAlpha = p.l * 2.5; g.fillStyle = p.f; g.fillRect(p.x, p.y, 3, 3); }); g.globalAlpha = 1;
      if (!(this.halt > 0 && Math.floor(this.halt * 10) % 2)) { g.save(); g.translate(this.x, 580); g.fillStyle = "#e2e8f0"; g.beginPath(); g.moveTo(0, -20); g.lineTo(16, 12); g.lineTo(0, 6); g.lineTo(-16, 12); g.closePath(); g.fill(); g.fillStyle = "#f97316"; g.beginPath(); g.moveTo(-6, 10); g.lineTo(0, 22 + Math.random() * 6); g.lineTo(6, 10); g.fill(); g.restore(); }
      g.fillStyle = "#fff"; g.font = "600 14px 'Space Grotesk',sans-serif"; g.textAlign = "left"; g.fillText("Welle " + this.welle, 14, 620); g.textAlign = "right"; g.fillText("❤".repeat(Math.max(0, this.leben)), 346, 620);
    },
    zieh: function (x) { this.zielX = x; }, ziehEnde: function () { this.zielX = null; },
    taste: function (k, an) { if (k === "ArrowLeft") this.links = an; if (k === "ArrowRight") this.rechts = an; }, mitLoslassen: true,
    knoepfe: [["◀", "ArrowLeft"], ["▶", "ArrowRight"]]
  });

  /* ================= 5. Plasma-Pong ================= */
  SP.push({
    id: "pong", name: "Plasma-Pong", emoji: "🏓", farbe: "#06b6d4", W: 360, H: 640,
    text: "Du gegen die FLARESSA-KI. Wer zuerst 7 Punkte hat, gewinnt.",
    hilfe: "Zieh deinen Schläger unten hin und her, oder ← →. Der Ball wird mit jedem Treffer schneller.",
    start: function (api) { this.api = api; this.ich = 180; this.ki = 180; this.p = [0, 0]; this.punkte = 0; this.anstoss(1); this.spur = []; this.zielX = null; },
    anstoss: function (r) { this.b = { x: 180, y: 320, vx: zufall(-140, 140), vy: 260 * r }; this.warte = 0.8; },
    update: function (dt) {
      var b = this.b, self = this;
      if (this.zielX !== null) this.ich += Math.max(-600 * dt, Math.min(600 * dt, this.zielX - this.ich));
      if (this.links) this.ich -= 380 * dt; if (this.rechts) this.ich += 380 * dt;
      this.ich = Math.max(40, Math.min(320, this.ich));
      var kiZiel = b.vy < 0 ? b.x : 180, kiTempo = 230 + this.p[1] * 20; this.ki += Math.max(-kiTempo * dt, Math.min(kiTempo * dt, kiZiel - this.ki)); this.ki = Math.max(40, Math.min(320, this.ki));
      if (this.warte > 0) { this.warte -= dt; return; }
      b.x += b.vx * dt; b.y += b.vy * dt; this.spur.push({ x: b.x, y: b.y }); if (this.spur.length > 12) this.spur.shift();
      if (b.x < 10 || b.x > 350) { b.vx *= -1; b.x = Math.max(10, Math.min(350, b.x)); this.api.ton("tick"); }
      function treffer(px, y, rich) { if (Math.abs(b.y - y) < 12 && Math.abs(b.x - px) < 44 && Math.sign(b.vy) === rich) { b.vy = -b.vy * 1.06; b.vx = (b.x - px) * 7 + b.vx * 0.3; b.y = y - rich * 12; self.api.ton("klick"); return true; } }
      if (treffer(this.ich, 590, 1)) this.punkte++;
      treffer(this.ki, 50, -1);
      if (b.y > 660) { this.p[1]++; this.api.ton("aua"); this.anstoss(-1); }
      if (b.y < -20) { this.p[0]++; this.punkte += 10; this.api.ton("jubel"); this.anstoss(1); }
      if (this.p[0] >= 7 || this.p[1] >= 7) { if (this.p[0] >= 7) this.punkte += 50; this.api.ende(this.punkte, this.p[0] >= 7 ? "Gewonnen! " + this.p[0] + ":" + this.p[1] : "Die KI gewinnt " + this.p[1] + ":" + this.p[0]); }
    },
    draw: function (g) {
      g.fillStyle = "#031016"; g.fillRect(0, 0, 360, 640);
      g.strokeStyle = "rgba(6,182,212,.35)"; g.setLineDash([10, 10]); g.beginPath(); g.moveTo(0, 320); g.lineTo(360, 320); g.stroke(); g.setLineDash([]);
      g.fillStyle = "rgba(6,182,212,.25)"; g.font = "700 90px 'Space Grotesk',sans-serif"; g.textAlign = "center"; g.fillText(this.p[1], 180, 220); g.fillText(this.p[0], 180, 490);
      var self = this; this.spur.forEach(function (p, i) { g.globalAlpha = i / self.spur.length * 0.5; g.fillStyle = "#67e8f9"; g.beginPath(); g.arc(p.x, p.y, 7 * i / self.spur.length, 0, 7); g.fill(); }); g.globalAlpha = 1;
      g.shadowColor = "#22d3ee"; g.shadowBlur = 18; g.fillStyle = "#e0f2fe"; g.beginPath(); g.arc(this.b.x, this.b.y, 8, 0, 7); g.fill();
      g.fillStyle = "#f472b6"; g.shadowColor = "#f472b6"; rund(g, this.ki - 40, 40, 80, 12, 6); g.fill();
      g.fillStyle = "#22d3ee"; g.shadowColor = "#22d3ee"; rund(g, this.ich - 40, 588, 80, 12, 6); g.fill(); g.shadowBlur = 0;
      g.fillStyle = "#fff"; g.font = "600 13px 'Space Grotesk',sans-serif"; g.fillText("KI", 180, 30); g.fillText("DU", 180, 625);
    },
    zieh: function (x) { this.zielX = x; }, ziehEnde: function () { this.zielX = null; },
    taste: function (k, an) { if (k === "ArrowLeft") this.links = an; if (k === "ArrowRight") this.rechts = an; }, mitLoslassen: true,
    knoepfe: [["◀", "ArrowLeft"], ["▶", "ArrowRight"]]
  });

  /* ================= 6. Ziegelbrecher ================= */
  SP.push({
    id: "ziegel", name: "Ziegelbrecher", emoji: "🧨", farbe: "#ef4444", W: 360, H: 640,
    text: "Lass den Ball abprallen und zerschlag alle bunten Ziegel. Jede Runde wird schwerer.",
    hilfe: "Zieh den Schläger oder ← →. Tippen schießt den Ball ab.",
    start: function (api) { this.api = api; this.x = 180; this.leben = 3; this.punkte = 0; this.runde = 0; this.zielX = null; this.funken = []; this.neueRunde(); },
    neueRunde: function () { this.runde++; this.z = []; var F = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#a855f7"]; for (var r = 0; r < Math.min(8, 4 + this.runde); r++) for (var c = 0; c < 8; c++) { if (this.runde > 1 && Math.random() < 0.12) continue; this.z.push({ x: 12 + c * 42, y: 80 + r * 22, f: F[r % 6], h: this.runde > 2 && r < 2 ? 2 : 1 }); } this.ballNeu(); },
    ballNeu: function () { this.b = { x: this.x, y: 566, vx: 0, vy: 0, fest: true }; },
    abschuss: function () { if (!this.b.fest) return; this.b.fest = false; var t = 300 + this.runde * 25; this.b.vx = zufall(-0.6, 0.6) * t; this.b.vy = -t; this.api.ton("klick"); },
    update: function (dt) {
      var b = this.b, self = this;
      if (this.zielX !== null) this.x += Math.max(-700 * dt, Math.min(700 * dt, this.zielX - this.x));
      if (this.links) this.x -= 420 * dt; if (this.rechts) this.x += 420 * dt;
      this.x = Math.max(40, Math.min(320, this.x));
      this.funken.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; p.l -= dt; }); this.funken = this.funken.filter(function (p) { return p.l > 0; });
      if (b.fest) { b.x = this.x; return; }
      var schritte = 3; for (var s = 0; s < schritte; s++) {
        b.x += b.vx * dt / schritte; b.y += b.vy * dt / schritte;
        if (b.x < 7 || b.x > 353) { b.vx *= -1; b.x = Math.max(7, Math.min(353, b.x)); this.api.ton("tick"); }
        if (b.y < 7) { b.vy = Math.abs(b.vy); this.api.ton("tick"); }
        if (b.vy > 0 && b.y > 570 && b.y < 586 && Math.abs(b.x - this.x) < 44) { var v = Math.hypot(b.vx, b.vy) * 1.01; var w = (b.x - this.x) / 44 * 1.1; b.vx = Math.sin(w) * v; b.vy = -Math.cos(w) * v; this.api.ton("klick"); }
        for (var i = 0; i < this.z.length; i++) { var z = this.z[i]; if (b.x > z.x - 6 && b.x < z.x + 44 && b.y > z.y - 6 && b.y < z.y + 24) {
          var ueberX = Math.min(b.x - z.x + 6, z.x + 44 - b.x), ueberY = Math.min(b.y - z.y + 6, z.y + 24 - b.y);
          if (ueberX < ueberY) b.vx *= -1; else b.vy *= -1;
          z.h--; if (z.h <= 0) { z.weg = true; this.punkte += 10 * this.runde; for (var k = 0; k < 6; k++) this.funken.push({ x: z.x + 19, y: z.y + 9, vx: zufall(-90, 90), vy: zufall(-140, 20), l: 0.6, f: z.f }); this.api.ton("bumm"); } else this.api.ton("tock");
          break; } }
        this.z = this.z.filter(function (z) { return !z.weg; });
      }
      if (b.y > 660) { this.leben--; this.api.ton("aua"); this.api.wackeln(10); if (this.leben <= 0) { this.api.ende(this.punkte); return; } this.ballNeu(); }
      if (!this.z.length) { this.punkte += 200; this.api.ton("jubel"); this.neueRunde(); }
    },
    draw: function (g) {
      var gr = g.createLinearGradient(0, 0, 0, 640); gr.addColorStop(0, "#1c0a0a"); gr.addColorStop(1, "#0b1020"); g.fillStyle = gr; g.fillRect(0, 0, 360, 640);
      this.z.forEach(function (z) { g.fillStyle = z.f; rund(g, z.x, z.y, 38, 18, 5); g.fill(); g.fillStyle = z.h > 1 ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.22)"; g.fillRect(z.x + 4, z.y + 3, 30, 4); });
      this.funken.forEach(function (p) { g.globalAlpha = Math.min(1, p.l * 2); g.fillStyle = p.f; g.fillRect(p.x, p.y, 4, 4); }); g.globalAlpha = 1;
      g.fillStyle = "#f8fafc"; g.shadowColor = "#fca5a5"; g.shadowBlur = 14; g.beginPath(); g.arc(this.b.x, this.b.y, 7, 0, 7); g.fill();
      g.fillStyle = "#ef4444"; g.shadowColor = "#ef4444"; rund(g, this.x - 44, 578, 88, 12, 6); g.fill(); g.shadowBlur = 0;
      g.fillStyle = "#fff"; g.font = "600 14px 'Space Grotesk',sans-serif"; g.textAlign = "left"; g.fillText("Runde " + this.runde, 14, 620); g.textAlign = "right"; g.fillText("❤".repeat(Math.max(0, this.leben)), 346, 620);
      if (this.b.fest) { g.textAlign = "center"; g.fillText("Tippen zum Abschießen", 180, 520); }
    },
    tap: function () { this.abschuss(); }, zieh: function (x) { this.zielX = x; }, ziehEnde: function () { this.zielX = null; },
    taste: function (k, an) { if (k === "ArrowLeft") this.links = an; if (k === "ArrowRight") this.rechts = an; if (k === " " && an) this.abschuss(); }, mitLoslassen: true,
    knoepfe: [["◀", "ArrowLeft"], ["●", " "], ["▶", "ArrowRight"]]
  });
})();
