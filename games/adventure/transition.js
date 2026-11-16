/* Adventure: transições ao passar por um portal. Fecha a tela (p de 0 a 1), troca de região e abre de novo (p de 1 a 0).
   Cada tipo é uma função draw(g, W, H, p, t) em TRANS_FX; a escolha vem do portal (fx) ou do bioma da região de destino.
   Para criar uma nova: acrescente aqui e o nome em TRANSITIONS (data.js). */

const TRANS_FX = {
  fade(g, W, H, p) { g.fillStyle = `rgba(0,0,0,${p})`; g.fillRect(0, 0, W, H); },
  vila(g, W, H, p) {                               // portões de madeira que se fecham
    const e = p * p * (3 - 2 * p), w = W / 2 * e;
    for (const [x0, dir] of [[0, 1], [W, -1]]) {
      const x = dir > 0 ? x0 : x0 - w; g.fillStyle = '#6a4426'; g.fillRect(x, 0, w, H);
      g.fillStyle = '#4a2e18'; for (let i = 1; i < 6; i++) g.fillRect(x + (w / 6) * i, 0, 3, H);
      g.fillStyle = '#2e2e34'; g.fillRect(x, H * .22, w, 10); g.fillRect(x, H * .72, w, 10);
      g.fillStyle = '#8a8a90'; for (let i = 0; i < 6; i++) { g.fillRect(x + (w / 6) * i + 8, H * .22 + 3, 4, 4); g.fillRect(x + (w / 6) * i + 8, H * .72 + 3, 4, 4); }
    }
    if (e > .97) { g.fillStyle = '#e0b040'; g.fillRect(W / 2 - 6, H / 2 - 10, 12, 20); }
  },
  floresta(g, W, H, p, t) {                        // folhas caindo até cobrir
    g.fillStyle = `rgba(20,40,18,${p * .95})`; g.fillRect(0, 0, W, H);
    const n = Math.floor(260 * p);
    for (let i = 0; i < n; i++) {
      const x = hash(i, 1) * W, y = (hash(i, 2) * H * 1.2 - H * .2) + p * 80 + Math.sin(t * 3 + i) * 6, s = 6 + hash(i, 3) * 10;
      g.save(); g.translate(x, y); g.rotate(i + t * (hash(i, 4) - .5) * 3); g.fillStyle = ['#c8a030', '#a85a20', '#5a8a30', '#3f6a28'][i % 4];
      g.beginPath(); g.ellipse(0, 0, s, s * .45, 0, 0, TAU); g.fill(); g.restore();
    }
  },
  pantano(g, W, H, p, t) {                         // névoa verde e bolhas
    g.fillStyle = `rgba(28,44,26,${p})`; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 14; i++) {
      const x = hash(i, 7) * W + Math.sin(t + i) * 30, y = hash(i, 8) * H, r = (120 + hash(i, 9) * 160) * (.3 + p);
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(120,160,100,${.5 * p})`); gr.addColorStop(1, 'rgba(120,160,100,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.strokeStyle = `rgba(170,220,140,${p})`; g.lineWidth = 2;
    for (let i = 0; i < 30 * p; i++) { const x = hash(i, 11) * W, y = H - ((t * 120 + hash(i, 12) * H) % H); g.beginPath(); g.arc(x, y, 3 + hash(i, 13) * 6, 0, TAU); g.stroke(); }
  },
  cripta(g, W, H, p) {                             // escuridão que fecha num círculo, com uma caveira no fim
    iris(g, W, H, p, '#0a0610');
    if (p > .55) { const a = (p - .55) / .45, sk = sprite(SPR.caveira, PAL.caveira, 'caveira'), z = Math.floor(Math.min(W, H) / 40); g.globalAlpha = a; g.imageSmoothingEnabled = false; g.drawImage(sk, W / 2 - sk.width * z / 2, H / 2 - sk.height * z / 2, sk.width * z, sk.height * z); g.globalAlpha = 1; }
  },
  caverna(g, W, H, p, t) { iris(g, W, H, p, '#120c0a', 18); },
  neve(g, W, H, p, t) {                            // nevasca até ficar tudo branco
    g.fillStyle = `rgba(235,242,250,${p})`; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff';
    for (let i = 0; i < 400 * Math.min(1, p * 1.5); i++) { const x = (hash(i, 1) * W + t * 300 * (.5 + hash(i, 3))) % W, y = (hash(i, 2) * H + t * 140) % H, s = 2 + hash(i, 4) * 4; g.fillRect(x, y, s, s); }
  },
  deserto(g, W, H, p, t) {                         // parede de areia na diagonal
    const x = -W * .4 + p * W * 1.8;
    g.fillStyle = '#d8b070'; g.beginPath(); g.moveTo(0, 0); g.lineTo(x, 0); g.lineTo(x - H * .5, H); g.lineTo(0, H); g.fill();
    g.fillStyle = 'rgba(160,110,50,.6)';
    for (let i = 0; i < 500; i++) { const y = hash(i, 5) * H, xx = x - y * .5 - hash(i, 6) * 120 + Math.sin(t * 20 + i) * 4; if (xx > 0) g.fillRect(xx, y, 3, 1.5); }
  },
  fogo(g, W, H, p, t) {                            // chamas que sobem
    const top = H * (1 - p * 1.25);
    const gr = g.createLinearGradient(0, top, 0, H); gr.addColorStop(0, 'rgba(255,200,60,0)'); gr.addColorStop(.12, '#ff9020'); gr.addColorStop(.4, '#c02a08'); gr.addColorStop(1, '#300804');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 16) g.lineTo(x, top + Math.sin(x * .05 + t * 8) * 18 + hash(x, 1) * 24);
    g.lineTo(W, H); g.fill();
  },
  magia(g, W, H, p, t) {                           // redemoinho roxo
    g.save(); g.translate(W / 2, H / 2); g.rotate(t * 3 + p * 4);
    const R = Math.hypot(W, H) / 2;
    for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? `rgba(90,40,160,${p})` : `rgba(40,20,90,${p})`; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, i / 12 * TAU, (i + 1) / 12 * TAU); g.fill(); }
    g.restore();
    const r = (1 - p) * R; const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, r + 1); gr.addColorStop(0, 'rgba(200,160,255,0)'); gr.addColorStop(1, `rgba(200,160,255,${p * .5})`); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  },
};
function iris(g, W, H, p, col, rough) {           // tudo escuro menos um círculo que encolhe
  const R = Math.hypot(W, H) / 2 * (1 - p * p * (3 - 2 * p));
  g.fillStyle = col; g.beginPath(); g.rect(0, 0, W, H);
  if (R > 1) { for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU, rr = R * (1 + (rough ? (hash(i, 9) - .5) * rough / 100 : 0)); i ? g.lineTo(W / 2 + Math.cos(a) * rr, H / 2 + Math.sin(a) * rr) : g.moveTo(W / 2 + rr, H / 2); } }
  g.fill('evenodd');
}

const Trans = {
  cv: null, on: false, OUT: .45, IN: .55,
  init(cv) { this.cv = cv; },
  // kind = tipo; mid = troca de região (chamada com a tela fechada)
  run(kind, mid) {
    if (!TRANS_FX[kind]) kind = 'fade';
    this.on = true; const t0 = performance.now(); let swapped = false;
    const step = () => {
      const t = (performance.now() - t0) / 1000, cv = this.cv, dpr = devicePixelRatio || 1;
      if (cv.width !== Math.round(cv.clientWidth * dpr)) { cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); }
      const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
      let p;
      if (t < this.OUT) p = t / this.OUT;
      else { if (!swapped) { swapped = true; mid(); } p = Math.max(0, 1 - (t - this.OUT) / this.IN); }
      TRANS_FX[kind](g, cv.width, cv.height, clamp(p, 0, 1), t);
      if (t < this.OUT + this.IN) requestAnimationFrame(step); else { g.clearRect(0, 0, cv.width, cv.height); this.on = false; }
    };
    requestAnimationFrame(step);
    setTimeout(() => { if (!swapped) { swapped = true; mid(); } }, this.OUT * 1000 + 80);   // aba escondida não roda requestAnimationFrame
    setTimeout(() => { this.on = false; }, (this.OUT + this.IN) * 1000 + 200);
  },
};
