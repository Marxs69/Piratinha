# 🏴‍☠️ PIRATINHA

## O que tem

- **Modo OS**: área de trabalho, janelas, taskbar, dock, menu Iniciar e apps.
- **Modo antigo**: a lista de sites em cards (sempre no celular).
- **App Jogos**: loja, biblioteca, comunidade e amigos fictícios.
- **Idiomas**: português e inglês (`js/i18n/`).

## Jogos

| Jogo | Pasta | Resumo |
|---|---|---|
| DOOM | `games/doom/` | Freedoom em WebAssembly. |
| Smithing Shop | `games/smithing/` | Forja: minere, forje e venda. |
| Hero's Journey | `games/combate/` | Auto-batalha com mochila. |
| Sim Colony | `games/colonia/` | Gerenciamento de colônia. |
| Zombie Fortress | `games/bastiao/` | Defesa de castelo em 3D contra zumbis. |
| RPG Adventure | `games/adventure/` | RPG de ação, sozinho ou em coop (até 4). |
| Grand Chronicle | `games/chronicle/` | Grande estratégia de 860 a 2200 em mundo aleatório. |

## Estrutura

```
index.html        carrega CSS e JS (a ordem importa)
assets/           ícones, wallpapers e imagens
css/              estilos
js/config/        links.js (sites, jogos, apps) e catalog.js (loja, amigos)
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
