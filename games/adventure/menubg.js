/* Adventure: fundo dos menus. As regiões passam como num slideshow: cada uma desliza devagar e some em fade para a próxima.
   Usa os mesmos mapas do jogo (REGIONS), então regiões novas do editor entram sozinhas. */

const MenuBg = {
  cv: $('#menu-bg'), imgs: {}, order: [], i: 0, t0: 0, cur: null, prev: null,
  SHOW: 9000, FADE: 1600,                          // ms em cada região e duração do fade
  shot(id) {                                       // escolhe um trecho e uma direção de passeio para a região
    const reg = REGIONS[id]; if (!this.imgs[id] || this.imgs[id].reg !== reg) this.imgs[id] = { reg, img: regionCanvas(reg) };
    const a = Math.random() * TAU;
    return { img: this.imgs[id].img, x: Math.random(), y: Math.random(), dx: Math.cos(a), dy: Math.sin(a), t0: performance.now() };
  },
  next() {
    if (!this.order.length || this.i >= this.order.length) { this.order = Object.keys(REGIONS).sort(() => Math.random() - .5); this.i = 0; }
    this.prev = this.cur; this.cur = this.shot(this.order[this.i++]); this.t0 = performance.now() - (this.prev ? 0 : this.FADE);   // o primeiro já entra visível
  },
  draw(s, alpha, now) {
    const g = this.cv.getContext('2d'), W = this.cv.width, H = this.cv.height, z = Math.max(Math.max(W / s.img.width, H / s.img.height) * 1.15, 2.5 * (devicePixelRatio || 1));   // cobre a tela, com pixels grandes
    const vw = W / z, vh = H / z, mx = Math.max(0, s.img.width - vw), my = Math.max(0, s.img.height - vh);
    const k = (now - s.t0) / (this.SHOW + this.FADE), x = clamp(s.x * mx + s.dx * k * 60, 0, mx), y = clamp(s.y * my + s.dy * k * 40, 0, my);
    g.globalAlpha = alpha; g.imageSmoothingEnabled = false;
    g.drawImage(s.img, x, y, Math.min(vw, s.img.width), Math.min(vh, s.img.height), 0, 0, Math.min(vw, s.img.width) * z, Math.min(vh, s.img.height) * z);
    g.globalAlpha = 1;
  },
  frame() {
    requestAnimationFrame(() => this.frame()); const now = performance.now();
    const on = ['title', 'create', 'mode'].some(id => $('#' + id).classList.contains('on'));
    this.cv.hidden = !on; if (!on) return;
    const dpr = devicePixelRatio || 1, W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
    if (this.cv.width !== W || this.cv.height !== H) { this.cv.width = W; this.cv.height = H; }
    if (!this.cur || now - this.t0 > this.SHOW) this.next();
    const g = this.cv.getContext('2d'); g.fillStyle = '#110e15'; g.fillRect(0, 0, W, H);
    const f = clamp((now - this.t0) / this.FADE, 0, 1);
    if (this.prev && f < 1) this.draw(this.prev, 1, now);
    this.draw(this.cur, f, now);
  },
};
MenuBg.frame();
