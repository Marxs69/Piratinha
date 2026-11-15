# 🏴‍☠️ PIRATINHA

Página inicial com cara de sistema operacional, em HTML, CSS e JavaScript puros: sem build, dependências ou servidor próprio.
Reúne links de sites de jogos numa área de trabalho com janelas, taskbar, dock, menu Iniciar, apps e jogos.

> Preferências, notas, progresso dos jogos e wallpapers próprios ficam só no navegador (`localStorage`).

## O que tem

- **Modo OS**: ícones arrastáveis, lixeira, menu de clique direito, janelas (sites abrem em `iframe`), taskbar, dock de jogos e menu Iniciar com busca.
- **Modo antigo**: a lista original em cards, por grupo (Repack, Scene, Tools, Outros). No celular a página abre sempre nele.
- **Apps**: Loja, Navegador, Terminal, Calculadora, Bloco de notas, Paint, Base64, QR Code, Gerador de senhas, Hash, testes de controle, teclado/mouse e monitor, Customização e Configurações.
- **Widgets**: música, monitor do sistema (falso) e frase do dia.
- **Idiomas**: inglês (padrão) e português, traduzidos em tempo real sobre o DOM (`js/i18n/`).

## Jogos

- **DOOM**: [Freedoom](https://freedoom.github.io/) em WebAssembly (motor Dwasm).
- **Smithing** (`games/smithing/`): gerenciamento de forja em pixel art. Mine, corte madeira, funda ligas, forje no ritmo do martelo, entregue encomendas e venda no leilão. A enciclopédia do jogo (📖) explica cada sistema.
- **Combate** (`games/combate/`): auto-batalha com mochila. Arrume os itens nas casas, veja a mochila do inimigo e lute. São 100 rodadas com um chefe a cada 10; depois do 10º a loja fecha e as rodadas ficam infinitas.
- **Colônia** (`games/colonia/`): gerenciamento de colônia. Escolha o lugar num mundo gerado por semente (globo ou mapa) vendo clima, água, solo e vida selvagem, monte o grupo (humanos, elfos e orcs) e dê ordens: construir, escavar, cortar, colher, atacar e alocar a casa. A mesa de pesquisa libera melhorias e a bancada faz espadas e armaduras (com o couro da caça). Há chuva e neve, animais agressivos e invasões de saqueadores.
- **Bastião** (`games/bastiao/`): defesa de castelo em estilo RTS, numa grade hexagonal em 3D de polígonos no estilo 32 bits (WebGL puro, sem bibliotecas nem texturas). A câmera não gira: arrasta, aproxima (roda) e inclina (Shift + roda, R/F ou botão do meio). O mapa é sorteado a cada partida (relevo, rios, florestas, rochas e jazidas), sempre com recursos ao alcance do castelo, que ainda tem um mercado. Aldeões e soldados são unidades: clique ou arraste para selecionar e use o botão direito para mandar andar, construir ou trabalhar; aldeões ociosos pegam serviço sozinhos. O castelo treina tudo: aldeões e espadachins de início; quartel e oficina são ampliações do próprio castelo (dois níveis cada, que também aumentam alcance e dano dele) e ficam ao lado das tropas no menu Treinar, que também abre ao clicar no castelo. Quartel nv1 libera lanceiros, arqueiros e T2; nv2 dá +25% de vida e dano aos combatentes, libera T3 e faz os aldeões revidarem. Oficina nv1 libera catapulta, trebuchet e a pesquisa Pólvora; nv2 (exige pólvora) libera o canhão. A pólvora também libera o arqueiro T3 (fuzileiro) e o nível 3 das torres, que passam a usar fuzis. O mercado é uma construção que já vem pronta e troca ouro por recursos. Muros vão de paliçada a troncos e pedra, e as ferramentas, de madeira a pedra e metal. As ondas de zumbis (comuns, corredores, saltadores, explosivos e brutamontes) começam pequenas e espaçadas e vão apertando; a cada 20 ondas vencidas termina uma fase, há uma trégua de 4 minutos e a fase seguinte vem com mais zumbis, mais fortes e mais rápidos. A partida começa pausada. Atalhos: 1 a 4 para as ferramentas, espaço pausa, Tab troca a velocidade. Parar o mouse meio segundo sobre um botão mostra um resumo; clicar mostra a explicação. Aldeões feridos se abrigam no castelo (cada abrigado acelera os tiros dele) e saem quando a área fica segura; o sino (G) recolhe ou solta todos. Os modelos são montados por código em `render3d.js` (tabela `DEFS`), e o cabeçalho de lá explica como trocar uma peça.

Nos jogos próprios, o equilíbrio fica em tabelas no topo de `game.js` e a arte em `sprites.js`.

## Estrutura

```
index.html        marcação e ordem de carregamento de CSS e JS
assets/           fonte, ícones dos sites e wallpapers
css/              base.css, old.css (modo antigo) e os/ (modo OS)
js/
  config/links.js ★ lista de sites, jogos e apps
  core/           DOM, armazenamento, janelas, QR Code
  desktop/        ícones, lixeira, wallpaper, menu de contexto
  shell/          menu Iniciar, modo antigo, relógio, configurações
  apps/           apps embutidos
  system/         energia, atualização e notificações
  widgets/        música, monitor, frase do dia
  i18n/           strings.js (traduções) e i18n.js (motor)
  main.js         inicialização
games/            doom/, smithing/, combate/, colonia/, bastiao/
```

Os scripts são clássicos (não módulos) e dependem da ordem do `index.html`: um arquivo novo entra depois do que ele usa e antes de `main.js`.

## Como rodar

```sh
python3 -m http.server 8000   # depois abra http://localhost:8000
```

Abrir o `index.html` direto também funciona, mas sem a lista de wallpapers e sem o DOOM. No GitHub Pages os wallpapers são lidos pela API do GitHub; com domínio próprio, preencha `GH` em `js/desktop/wallpaper.js`.

## Personalizando

- **Site**: item em `LINKS` (`js/config/links.js`), com o grupo em `g` (`repack`, `scene`, `tools` ou `out`).
- **Wallpaper**: imagem em `assets/wallpapers/`.
- **App ou jogo**: função `openAlgo()` em `js/apps/`, `<script>` no `index.html` e item em `APPITEMS`.
- **Texto novo**: linha `[pt, en]` em `js/i18n/strings.js`.

## Licenças de terceiros

- **Freedoom**: BSD (`games/doom/freedoom/COPYING.txt`).
- **Dwasm**: GNU GPL v2 (`games/doom/COPYING-dwasm.txt`).
- Os ícones dos sites vêm do serviço de favicons do Google, com reserva em `assets/icons/sites/`.
