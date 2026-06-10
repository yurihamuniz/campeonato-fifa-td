# Campeonato FIFA TD — Bracket Online

Página HTML estática que renderiza o campeonato lendo os resultados de uma planilha Google. Auto-refresh a cada 20s — todo mundo vê os placares e a classificação atualizarem sem precisar dar reload.

**Formato:** 14 participantes, 2 grupos de 7 (Grupo A = posições ímpares, Grupo B = pares). Cada um joga 4 partidas na fase de grupos. Os 4 melhores de cada grupo avançam para o mata-mata (quartas → semis → final + disputa de 3º lugar).

## Como funciona

```
┌──────────────────┐    fetch CSV     ┌──────────────────┐
│  Planilha Google │ ◄──────────────  │  index.html      │
│  (Publicada na   │   a cada 20s     │  hospedado no    │
│   web como CSV)  │                  │  GitHub Pages    │
└────────▲─────────┘                  └──────────────────┘
         │ edita placar via celular
   ┌─────┴──────┐
   │   Admin    │
   └────────────┘
```

A página **calcula a classificação dos grupos** (pontos, saldo, etc.) e **monta o mata-mata automaticamente** a partir dela. Você só preenche: quem é cada participante, qual clube pegou, e os placares.

## Estrutura da planilha

Uma única aba, com **duas seções** identificadas pela coluna `tipo`:

| tipo | id | grupo | pos1 | pos2 | nome | clube | placar1 | placar2 | vencedor | status |
| ---- | -- | ----- | ---- | ---- | ---- | ----- | ------- | ------- | -------- | ------ |

### Linhas `participante` (14 linhas)

Definem quem está em cada posição do sorteio e **qual clube pegou**:

- `tipo` = `participante`
- `id` = posição no sorteio (1 a 14)
- `nome` = nome do jogador
- `clube` = clube que ele escolheu (ver lista de clubes válidos abaixo)
- `grupo` = `A` ou `B` (opcional — se vazio, é calculado: ímpar→A, par→B)

> O clube é registrado **uma vez só** aqui. Todos os jogos puxam o escudo automaticamente.

### Linhas `jogo`

- **Fase de grupos** (28 linhas, IDs `GA1`–`GA14` e `GB1`–`GB14`): já vêm com `pos1`/`pos2` preenchidos (o chaveamento é fixo). Você só preenche `placar1`, `placar2` e `status`.
- **Mata-mata** (8 linhas: `QF1`–`QF4`, `SF1`, `SF2`, `TER`, `FINAL`): deixe `pos1`/`pos2` vazios — os confrontos são montados automaticamente a partir da classificação. Você preenche `placar1`, `placar2`, `status` e, em caso de empate, `vencedor`.

Copie o arquivo [`sample.csv`](sample.csv) (Arquivo → Importar → Substituir planilha) para começar com tudo pronto.

## Pontuação e classificação

- Vitória = **3 pts** · Empate = **1 pt** · Derrota = **0**
- Critérios de desempate (nesta ordem): **pontos → saldo de gols → gols marcados → confronto direto → posição no sorteio**

## Montagem do mata-mata (automática)

Quando **todos os 28 jogos de grupo** estiverem `finalizado`, a página monta:

| Confronto | Seeding |
| --------- | ------- |
| QF1 | 1º Grupo A × 4º Grupo B |
| QF2 | 2º Grupo A × 3º Grupo B |
| QF3 | 1º Grupo B × 4º Grupo A |
| QF4 | 2º Grupo B × 3º Grupo A |
| Semi 1 | Vencedor QF1 × Vencedor QF2 |
| Semi 2 | Vencedor QF3 × Vencedor QF4 |
| 3º lugar | Perdedor Semi 1 × Perdedor Semi 2 |
| Final | Vencedor Semi 1 × Vencedor Semi 2 |

Antes dos grupos terminarem, os confrontos do mata-mata aparecem como "a definir" e a classificação mostra "provisória".

**Override manual:** se precisar mudar um confronto do mata-mata (ex: alguém saiu mais cedo), basta preencher `pos1`/`pos2` daquela linha com as posições dos participantes — isso tem prioridade sobre o automático. Para desligar o automático de vez, mude `SEED_KNOCKOUT_FROM_STANDINGS` para `false` no [`app.js`](app.js).

## Empates no mata-mata

No mata-mata não pode haver empate. Se o jogo terminar empatado e for decidido na prorrogação/pênaltis, preencha a coluna `vencedor` com `1` ou `2` (referente ao lado 1 ou lado 2 do confronto). Na fase de grupos, empate é resultado válido (1 ponto para cada) — não use a coluna `vencedor`.

## Setup (6 passos)

1. Crie uma planilha Google e importe o [`sample.csv`](sample.csv).
2. Preencha as 14 linhas `participante` com nome + clube (após o sorteio externo).
3. **Arquivo → Compartilhar → Publicar na web → CSV** e copie a URL gerada.
4. Cole a URL na constante `SHEET_CSV_URL` no [`app.js`](app.js).
5. Suba para o GitHub e ative **Settings → Pages → branch main**.
6. Compartilhe o link `https://<seu-user>.github.io/campeonato-fifa-td/`.

## Atualizando durante o torneio

1. Abra a planilha (app Google Sheets no celular funciona bem).
2. Comece um jogo → mude `status` para `ao_vivo` (o card pulsa em roxo).
3. Atualize `placar1`/`placar2` conforme rolam os gols.
4. Fim do jogo → `status` para `finalizado`. A classificação recalcula sozinha.
5. Mata-mata: quando os grupos acabam, os confrontos aparecem automaticamente.

## Clubes válidos

Use exatamente estes nomes na coluna `clube` para o escudo aparecer:

**5★** — `Real Madrid`, `Barcelona`, `PSG`, `Bayern de Munique`, `Liverpool`, `Arsenal`, `Manchester City`, `Inter de Milão`

**4,5★** — `Atlético de Madrid`, `Napoli`, `Borussia Dortmund`, `Milan`, `Newcastle United`, `Tottenham`, `Juventus`, `RB Leipzig`, `Bayer Leverkusen`, `Chelsea`, `Manchester United`

**4★** — `Galatasaray`

> Dica: no Sheets, selecione a coluna `clube` → **Dados → Validação de dados → Lista de itens** e cole os 20 nomes. Vira dropdown e elimina erro de digitação.

## Estrutura dos arquivos

```
campeonato-fifa-td/
├── index.html        # classificação dos grupos + mata-mata
├── style.css         # paleta TD B2B + layout responsivo
├── app.js            # fetch + cálculo de classificação + seeding + render
├── sample.csv        # planilha-modelo (importar no Google Sheets)
├── README.md         # este arquivo
└── assets/
    ├── logo-TD.png
    ├── logo-TD-branco.png
    └── clubs/        # 20 escudos PNG dos clubes
```

Escudos do repo público [luukhopman/football-logos](https://github.com/luukhopman/football-logos).

## Rodar localmente

Deixe `SHEET_CSV_URL = ""` no `app.js` e sirva a pasta com um servidor estático (`npx serve` ou Live Server do VSCode). Vai usar o `sample.csv` local.

## Paleta TD B2B

| Cor | Hex | Uso |
| --- | --- | --- |
| Black | `#020406` | fundo |
| Purple | `#A683E8` | destaque, classificados, "ao vivo" |
| Light Blue | `#A1BFF6` | acentos, "finalizado" |
| White | `#EAECEF` | texto |
