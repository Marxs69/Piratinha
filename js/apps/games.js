/* Jogos (launcher no estilo Steam): abas Loja, Biblioteca e Comunidade no topo; barra fixa embaixo com + Adicionar jogo (esquerda), Downloads com o jogo que está baixando (centro) e Amigos (direita).
   Loja: barra rolável de destaques e lista de todos os jogos fictícios (js/config/catalog.js).
   Biblioteca: lista à esquerda; à direita capa (logo e nome ao centro, fundo próprio de cada jogo), Jogar/Instalar e descrição.
   Comunidade: imagens postadas pelos amigos. Amigos: quem está jogando o quê (js/system/friends.js). Downloads e Amigos abrem um painel por cima. */

const PLAYED = store.get('piratinha-played', {});            // url do jogo -> momento da última sessão
let gamesDraw = null;                                        // redesenha a biblioteca aberta (ex.: ao jogar pela dock)
function playGame(i) {                                       // toda abertura de jogo passa por aqui (biblioteca, dock, área de trabalho)
  const g = GAMES[i]; PLAYED[g.u] = Date.now(); store.set('piratinha-played', PLAYED);
  openApp(g); if (gamesDraw) gamesDraw();
}

// atualizações aleatórias dos jogos disponíveis (os do app Jogos): entram na fila de downloads e baixam uma de cada vez, mesmo com a janela fechada
const rnd = n => Math.random() * n | 0;
const UPDG = POOL.filter(g => g.li != null), newUpd = () => ({ g: UPDG[rnd(UPDG.length)], v: 'v' + (1 + rnd(4)) + '.' + rnd(10) + '.' + rnd(20), m: UPDNOTES[rnd(UPDNOTES.length)], s: .3 + Math.random() * 18, d: 0, sp: 0 });
const DL = { q: [newUpd(), newUpd(), newUpd()], done: [newUpd(), newUpd()].map(u => Object.assign(u, { d: u.s })) };
let dlDraw = null;
setInterval(() => {
  const u = DL.q[0];
  if (u) { u.sp = 15 + Math.random() * 30; u.d = Math.min(u.s, u.d + u.sp / 1024); if (u.d >= u.s) { DL.q.shift(); DL.done.unshift(u); DL.done.length = Math.min(DL.done.length, 6); } }
  if (dlDraw) dlDraw();
}, 1000);
(function addUpd() { setTimeout(() => { DL.q.push(newUpd()); addUpd(); }, (40 + Math.random() * 60) * 1000); })();

function openGames() {
  createWindow({ id: 'sys:games', title: 'Jogos', mk: etile('🕹️'), w: 900, h: 580, sys: true, body: v => {
    v.classList.add('st', 'gl', 'gms');
    v.innerHTML = '<nav class="gtabs"><button data-t="shop">Loja</button><button data-t="lib">Biblioteca</button><button data-t="com">Comunidade</button></nav><div class="gpane"></div>'
      + '<div class="gpop gapop" hidden><p>Não é possível adicionar jogos: o Piratinha só roda o que já vem a bordo.</p></div><div class="gpop gdpop" hidden></div><div class="gpop gfpop" hidden></div>'
      + '<footer class="gfoot"><span class="gfstart"><button class="gabtn">+ Adicionar jogo</button></span><span class="gfmid"><button class="gnews"></button><button class="gdbtn"></button></span><span class="gfend"><button class="gfbtn"></button></span></footer>';
    const pane = $('.gpane', v), fpop = $('.gfpop', v), dpop = $('.gdpop', v), fbtn = $('.gfbtn', v), dbtn = $('.gdbtn', v), news = $('.gnews', v);
    const all = LINKS.filter(l => l.cat === 'jogos'); let sel = all[0], tab = 'lib';
    const mk = (t, c, x, f) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; if (f) e.onclick = f; return e; };
    const inst = l => !OFF.has(idOf(l));
    const mark = t => v.querySelectorAll('.gtabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    const show = t => { tab = t; mark(t); pane.innerHTML = ''; pane.scrollTop = 0; ({ shop, lib, com })[t](); };
    v.querySelectorAll('.gtabs button').forEach(b => b.onclick = () => show(b.dataset.t));
    gamesDraw = () => { if (v.isConnected && tab === 'lib') show('lib'); };

    // painéis da barra inferior (Downloads e Amigos): só um aberto por vez, fecham ao clicar fora
    const pops = [[$('.gapop', v), $('.gabtn', v), () => {}], [dpop, dbtn, () => dls()], [fpop, fbtn, () => fr()]];
    const closePops = () => pops.forEach(([p, b]) => { p.hidden = true; b.classList.remove('on'); });
    pops.forEach(([p, b, draw]) => b.onclick = () => { const open = p.hidden; closePops(); if (open) { p.hidden = false; b.classList.add('on'); draw(); } });
    v.addEventListener('pointerdown', e => { if (!e.target.closest('.gpop, .gfbtn, .gdbtn, .gabtn, .gnews')) closePops(); });
    const fcount = () => { fbtn.textContent = '👥 Amigos'; fbtn.append(mk('small', '', ' ' + FS.filter(x => x.s).length + ' online')); };
    friendsDraw = () => { if (!v.isConnected) return; fcount(); if (!fpop.hidden) fr(); };
    let shown = null;                                        // ao lado de Downloads: ícone e nome do jogo baixando (ou do último concluído)
    const dcount = () => {
      const u = DL.q[0]; dbtn.textContent = '⬇ Downloads'; if (u) dbtn.append(mk('small', '', ' ' + Math.floor(u.d / u.s * 100) + '%'));
      const n = u || DL.done[0]; news.hidden = !n; if (n && n !== shown) { shown = n; news.textContent = ''; news.append(gtile(n.g), mk('span', '', n.g.n)); }
    };
    dlDraw = () => { if (!v.isConnected) return; dcount(); if (!dpop.hidden) dls(); };
    news.onclick = () => dbtn.click();

    function lib() {                                         // biblioteca
      pane.innerHTML = '<div class="glib"><aside class="sd"><input type="text" class="sbox" placeholder="Buscar jogo" spellcheck="false"><div class="gll"></div></aside><section class="sm gd"></section></div>';
      const list = $('.gll', pane), det = $('.gd', pane), q = $('.sbox', pane);
      const pin = (l, where, ico, sh, hide) => {             // mostrar ou tirar da dock / área de trabalho
        const on = placeOf(l) === where, b = mk('button', 'pill pinb' + (on ? ' on' : ''), ico, () => { setPlace(l, on ? 'none' : where); draw(); });
        b.title = on ? hide : sh; return b;
      };
      function detail(l) {
        det.innerHTML = ''; if (!l) return;
        const hero = mk('div', 'gh'), bar = mk('div', 'ga'), t = PLAYED[l.u];
        hero.dataset.g = (l.u.match(/games\/([^/]+)/) || [])[1] || ''; hero.append(mk('i', '', l.e), mk('h2', '', l.n));   // data-g escolhe o fundo do jogo (apps.css)
        if (inst(l)) {
          bar.append(mk('button', 'gplay', '▶ Jogar', () => openApp(l)),
            mk('span', 'gst', 'Instalado · ' + (t ? 'Última sessão: ' + new Date(t).toLocaleDateString(LOC[pref.lang]) : 'Nunca jogado')),
            pin(l, 'dock', '🧷', 'Mostrar na dock', 'Tirar da dock'), pin(l, 'desktop', '🖥️', 'Mostrar na área de trabalho', 'Tirar da área de trabalho'),
            mk('button', 'pill danger', 'Desinstalar', () => { setInst(l, false); draw(); }));
        } else {
          const b = mk('button', 'gplay', 'Instalar'); b.onclick = () => { b.textContent = 'Instalando…'; b.disabled = true; setTimeout(() => { setInst(l, true); draw(); }, 300); };
          bar.append(b, mk('span', 'gst', 'Não instalado'));
        }
        det.append(hero, bar, mk('p', 'gdesc', l.d));
      }
      function draw() {
        const s = q.value.trim().toLowerCase(), shown = all.filter(l => !s || [l.n, tr(l.n), l.d, tr(l.d)].join(' ').toLowerCase().includes(s));
        if (!shown.includes(sel)) sel = shown[0];
        list.innerHTML = '';
        shown.forEach(l => { const b = mk('button', 'cat' + (l === sel ? ' on' : '') + (inst(l) ? '' : ' off'), null, () => { sel = l; [...list.children].forEach(x => x.classList.toggle('on', x === b)); detail(l); }); b.append(tile(l), mk('span', '', l.n)); b.ondblclick = () => { if (inst(l)) openApp(l); }; b.addEventListener('contextmenu', e => { if (inst(l)) itemMenu(e, l, placeOf(l)); }); list.append(b); });
        if (!shown.length) list.append(mk('p', 'empty', 'Nada encontrado.'));
        detail(sel);
      }
      q.oninput = draw; draw();
    }

    const money = x => 'Z$ ' + x.toLocaleString(LOC[pref.lang], { minimumFractionDigits: 2, maximumFractionDigits: 2 });   // dólar zimbabuano de 1990
    function price(g) {                                      // preço no estilo Steam: -50% em verde, preço antigo riscado e o novo
      const p = mk('span', 'gpr'); if (g.p) p.title = 'Dólares zimbabuanos de 1990';
      if (!g.p) p.append(mk('span', 'gnew', 'Grátis'));
      else if (g.d) p.append(mk('span', 'gdc', '-' + g.d + '%'), mk('span', 'gold', money(g.p)), mk('span', 'gnew', money(Math.round(g.p * (100 - g.d)) / 100)));
      else p.append(mk('span', 'gnew', money(g.p)));
      return p;
    }
    const players = g => FRIENDS.filter((f, k) => FS[k].s === 2 && FS[k].g === g);
    const avatar = f => { const a = mk('span', 'fav', f.e); a.style.background = f.c; a.title = f.n; return a; };
    function shop() {                                        // loja: destaques numa barra rolável e, abaixo, todos os jogos
      const w = mk('div', 'gshop'), car = mk('div', 'gcar'), cw = mk('div', 'gcw'), list = mk('div', 'glist');
      const step = d => car.scrollBy({ left: d * car.clientWidth * .8, behavior: 'smooth' });
      car.onwheel = e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); car.scrollLeft += e.deltaY; } };
      SHOP.filter(g => g.f).forEach(g => { const c = mk('button', 'gcard', null, () => page(g)); c.append(gtile(g), mk('b', '', g.n), price(g)); car.append(c); });
      SHOP.forEach(g => { const r = mk('button', 'gli', null, () => page(g)), t = mk('div', 'gtx'); t.append(mk('b', '', g.n), mk('small', '', g.t)); r.append(gtile(g), t, price(g)); list.append(r); });
      cw.append(mk('button', 'garr', '‹', () => step(-1)), car, mk('button', 'garr', '›', () => step(1)));
      w.append(mk('h3', 'gsec', 'Destaques'), cw, mk('h3', 'gsec', 'Todos os jogos'), list); pane.append(w);
    }
    function page(g) {                                       // página de um jogo da loja
      tab = 'shop'; mark('shop'); pane.innerHTML = ''; pane.scrollTop = 0;
      const hero = mk('div', 'gh'), bar = mk('div', 'ga'), buy = mk('button', 'gplay', g.p ? 'Comprar' : 'Instalar'), st = mk('span', 'gst', g.t), fr = players(g);
      hero.style.background = 'radial-gradient(circle at 50% 40%, ' + g.c[0] + ', ' + g.c[1] + ' 75%)'; hero.append(mk('i', '', g.e), mk('h2', '', g.n));
      buy.onclick = () => { buy.disabled = true; st.textContent = g.p ? 'Pagamento recusado: só aceitamos dobrões.' : 'Servidor fora do ar. Tente nunca.'; };
      bar.append(mk('button', 'pill', '‹ Voltar', () => show('shop')), buy, st, price(g));
      pane.append(hero, bar);
      if (g.i) { const img = mk('img', 'gshot'); img.src = g.i; img.alt = g.n; pane.append(img); }   // imagem do jogo
      if (fr.length) { const p = mk('div', 'gfp'); p.append(mk('span', '', fr.length === 1 ? '1 amigo jogando' : fr.length + ' amigos jogando'), ...fr.map(avatar)); pane.append(p); }
    }

    function com() {                                         // comunidade: imagens postadas pelos amigos
      const w = mk('div', 'gcom');
      POSTS.forEach(p => {
        const f = FRIENDS.find(x => x.n === p.a), g = POOL.find(x => x.n === p.g), c = mk('div', 'gpost'), img = mk('img'), by = mk('div', 'gby'), t = mk('div', 'gtx'), like = mk('button', 'glike');
        img.src = p.i; img.alt = ''; img.loading = 'lazy'; if (p.px) img.classList.add('px');
        t.append(mk('b', '', p.a), mk('small', '', p.g)); by.append(avatar(f), t);
        let on = false; const lk = () => { like.textContent = '👍 ' + (p.l + on); like.classList.toggle('on', on); }; like.onclick = () => { on = !on; lk(); }; lk();
        c.append(img, by, mk('p', '', p.m), like);
        if (g) { img.style.cursor = 'pointer'; img.onclick = () => { if (g.li == null) page(g); else { sel = all.find(l => l.u === GAMES[g.li].u) || sel; show('lib'); } }; }
        w.append(c);
      });
      pane.append(w);
    }

    function dls() {                                         // downloads (painel por cima): baixando, na fila e concluídos
      dpop.innerHTML = ''; const w = mk('div', 'gfr');
      const row = (u, k) => {
        const r = mk('div', 'gfi gdl'), t = mk('div', 'gtx'), gb = x => x.toLocaleString(LOC[pref.lang], { maximumFractionDigits: 1 }) + ' GB';
        t.append(mk('b', '', u.g.n), mk('small', '', u.v + ' · ' + u.m));
        if (k === 0) { const b = mk('div', 'pbar'), i = mk('i'); i.style.width = (u.d / u.s * 100) + '%'; b.append(i); t.append(b, mk('small', '', gb(u.d) + ' / ' + gb(u.s) + ' · ' + (u.sp | 0) + ' MB/s')); }
        else t.append(mk('small', '', gb(u.s)));
        r.append(gtile(u.g), t); return r;
      };
      [['Baixando', DL.q.slice(0, 1), 0], ['Na fila', DL.q.slice(1), 1], ['Concluídos', DL.done, 2]].forEach(([h, l, k]) => { if (!l.length) return; w.append(mk('h3', 'gsec', h)); l.forEach(u => w.append(row(u, k))); });
      if (!DL.q.length && !DL.done.length) w.append(mk('p', 'empty', 'Nenhum download.'));
      dpop.append(w);
    }

    function fr() {                                          // amigos (painel por cima): jogando (nome do jogo em verde), online e offline
      fpop.innerHTML = ''; const w = mk('div', 'gfr'), name = { 2: 'Jogando', 1: 'Online', 0: 'Offline' };
      [2, 1, 0].forEach(s => {
        const fs = FRIENDS.map((f, k) => [f, FS[k]]).filter(x => x[1].s === s); if (!fs.length) return;
        const h = mk('h3', 'gsec', name[s]); h.append(mk('small', '', ' (' + fs.length + ')')); w.append(h);
        fs.forEach(([f, x]) => {
          const r = mk('div', 'gfi s' + s), t = mk('div', 'gtx');
          t.append(mk('b', '', f.n), mk('small', '', s === 2 ? x.g.n : name[s])); r.append(avatar(f), t);
          if (s === 2) {
            const l = x.g.li != null && all.find(l => l.u === GAMES[x.g.li].u);
            if (l) r.append(mk('button', 'pill', inst(l) ? 'Jogar' : 'Instalar', () => { closePops(); if (inst(l)) playGame(x.g.li); else { sel = l; show('lib'); } }));
            else r.append(mk('button', 'pill', 'Ver na Loja', () => { closePops(); page(x.g); }));
          }
          w.append(r);
        });
      });
      fpop.append(w);
    }
    fcount(); dcount(); show('lib');
  } });
}
