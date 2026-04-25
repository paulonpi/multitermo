# RFC: Página "Como Jogar"

## Contexto

Novos jogadores chegam ao jogo sem contexto — não há explicação das regras, dos tiles coloridos nem da dinâmica competitiva. Isso aumenta o atrito inicial e pode confundir quem nunca jogou o Termo original. Uma tela de regras resolve o onboarding e deixa explícita a proposta competitiva do jogo.

---

## Conteúdo da Página

### Título e crédito

```
Termo Multiplayer
Baseado no Termo (term.ooo) — o Wordle em português.
```

Link clicável `term.ooo` abrindo em nova aba.

---

### Seção 1 — Objetivo

> Descubra a palavra de 5 letras em até **6 tentativas**.  
> Dois jogadores tentam adivinhar a **mesma palavra** ao mesmo tempo, cada um no seu próprio tabuleiro.

---

### Seção 2 — Como as dicas funcionam

Após cada tentativa, cada letra recebe uma cor:

| Tile | Significado |
|---|---|
| 🟩 Verde | Letra certa na posição certa |
| 🟨 Amarelo | Letra existe na palavra, mas na posição errada |
| ⬛ Cinza | Letra não existe na palavra |

**Exemplos visuais** (renderizados como tiles reais do jogo):

- `T U R M A` → T em verde (posição certa)
- `V I O L A` → O em amarelo (existe, posição errada)
- `P U L G A` → G em cinza (não existe)

**Regras adicionais:**
- Acentos são preenchidos automaticamente e não afetam as dicas
- Palavras podem ter letras repetidas

---

### Seção 3 — A dinâmica competitiva

> Você vê o progresso do adversário em tempo real — quantas tentativas ele fez e o resultado de cada linha — mas **sem revelar as letras**.

**Como vencer uma rodada:**
- Acerte a palavra antes do adversário → vitória da rodada
- Se nenhum dos dois acertar em 6 tentativas → vence quem tiver acertado mais letras na melhor tentativa
- Se ambos acertarem no mesmo turno → empate (nenhum ponto)

**A partida:**
- 5 rodadas com palavras diferentes
- Vence a partida quem ganhar mais rodadas
- Em caso de empate no placar → empate na partida

---

### Seção 4 — Timer

> Cada rodada tem um limite de **5 minutos**. Se o tempo acabar antes de alguém acertar, a rodada termina com o critério de melhor tentativa.

---

## Design da Tela

- Tela simples, fundo escuro consistente com o restante do jogo
- Scroll vertical para dispositivos pequenos
- Tiles de exemplo renderizados com os **componentes `Tile` já existentes** (reutiliza estilos reais)
- Link `term.ooo` com ícone de external link
- Botão "Jogar" no final → volta para HomeScreen

---

## Navegação

Botão `?` ou "Como Jogar" adicionado na HomeScreen (canto superior direito ou abaixo dos botões principais).

```
HomeScreen  ──[Como Jogar]──►  HowToPlayScreen  ──[Jogar / ←]──►  HomeScreen
```

Não há back button de browser a tratar — o botão "Jogar" é o único ponto de saída.

---

## Arquivos Modificados / Criados

| Arquivo | Mudança |
|---|---|
| `frontend/src/screens/HowToPlayScreen.tsx` | **novo** — página de regras |
| `frontend/src/App.tsx` | novo `case 'how_to_play'` |
| `frontend/src/hooks/useGame.ts` | `'how_to_play'` adicionado ao tipo `Screen` |
| `frontend/src/screens/HomeScreen.tsx` | botão "Como Jogar" |
| `frontend/src/types.ts` | `Screen` union atualizado |

---

## Verificação

1. Clicar em "Como Jogar" na HomeScreen → abre a tela de regras
2. Tiles de exemplo renderizam com as cores corretas (verde, amarelo, cinza)
3. Link `term.ooo` abre em nova aba
4. Botão "Jogar" volta para a HomeScreen sem perder o nome digitado (se já preenchido)
5. Layout legível em mobile (375 px) e desktop
