/* Jogos (biblioteca no estilo de launcher): lista à esquerda; à direita capa (logo e nome ao centro, fundo próprio de cada jogo), Jogar/Instalar e descrição */

const PLAYED = store.get('piratinha-played', {});            // url do jogo -> momento da última sessão
let gamesDraw = null;                                        // redesenha a biblioteca aberta (ex.: ao jogar pela dock)
function playGame(i) {                                       // toda abertura de jogo passa por aqui (biblioteca, dock, área de trabalho)
  const g = GAMES[i]; PLAYED[g.u] = Date.now(); store.set('piratinha-played', PLAYED);
  openApp(g); if (gamesDraw) gamesDraw();
}

function openGames() {
  createWindow({ id: 'sys:games', title: 'Jogos', mk: etile('🕹️'), w: 900, h: 580, sys: true, body: v => {
    v.classList.add('st', 'gl'); v.innerHTML = '<aside class="sd"><input type="text" class="sbox" placeholder="Buscar jogo" spellcheck="false"><div class="gll"></div></aside><section class="sm gd"></section>';
    const list = $('.gll', v), det = $('.gd', v), q = $('.sbox', v), all = LINKS.filter(l => l.cat === 'jogos'); let sel = all[0];
    const mk = (t, c, x, f) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; if (f) e.onclick = f; return e; };
    const inst = l => !OFF.has(idOf(l));
    const pin = (l, where, ico, show, hide) => {             // mostrar ou tirar da dock / área de trabalho
      const on = placeOf(l) === where, b = mk('button', 'pill pinb' + (on ? ' on' : ''), ico, () => { setPlace(l, on ? 'none' : where); draw(); });
      b.title = on ? hide : show; return b;
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
    q.oninput = draw; gamesDraw = draw; draw();
  } });
}
