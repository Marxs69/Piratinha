# 🏴‍☠️ PIRATINHA

Página inicial com cara de sistema operacional, em HTML, CSS e JavaScript puros (sem build nem servidor).
Tudo o que o usuário muda fica só no navegador (`localStorage`).

## O que tem

- **Modo OS**: área de trabalho, janelas, taskbar, dock, menu Iniciar e apps.
- **Modo antigo**: a lista de sites em cards (sempre no celular).
- **Idiomas**: português e inglês (`js/i18n/`).

## Jogos

| Jogo | Pasta | Resumo |
|---|---|---|
| DOOM | `games/doom/` | Freedoom em WebAssembly. |
| Smithing | `games/smithing/` | Forja: minere, forje e venda. |
| Combate | `games/combate/` | Auto-batalha com mochila. |
| Colônia | `games/colonia/` | Gerenciamento de colônia. |
| Bastião | `games/bastiao/` | Defesa de castelo em 3D contra zumbis. |
| Adventure | `games/adventure/` | RPG de ação, sozinho ou em coop (até 4). |

O equilíbrio de cada jogo fica nas tabelas do topo de `game.js` (no Adventure, em `data.js`).

### Adventure

- **Coop**: quem cria a sala hospeda o jogo; os outros entram pelo código. Conexão P2P (`lib/trystero.js`). "Só neste navegador" testa com duas janelas.
- **Mapas**: `regions.js`. Classes, itens, monstros, NPCs e missões: `data.js`.
- **Editor** (`index.html#dev`): só aparece no seu computador (localhost ou arquivo aberto direto), nunca no GitHub Pages, e pede senha. A senha fica só no navegador; para esquecê-la, apague `adventure-devkey` do armazenamento do site.
- **Salvar no projeto** (aba Arquivo) grava o `regions.js`. No Brave, ligue `brave://flags/#file-system-access-api`; sem isso, ele baixa o arquivo.

## Estrutura

```
index.html        carrega CSS e JS (a ordem importa)
assets/           ícones, wallpapers e capas dos jogos
css/              estilos
js/config/        links.js: sites, jogos e apps
js/               núcleo, área de trabalho, apps, idiomas
games/            um jogo por pasta
```

## Rodar

```sh
python3 -m http.server 8000   # abra http://localhost:8000
```

## Personalizar

- **Site**: item em `LINKS` (`js/config/links.js`).
- **Jogo**: pasta em `games/`, item em `GAMES` e `APPITEMS`, capa em `assets/games/` e `css/os/apps.css`.
- **Texto**: linha `[pt, en]` em `js/i18n/strings.js`.

## Licenças

- Freedoom: BSD. Dwasm: GPL v2 (`games/doom/`).
- Fontes: OFL 1.1 (`games/<jogo>/fonts/`).
- Trystero: MIT (`games/adventure/lib/`).
