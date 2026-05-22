# Campeonato FIFA TD — Bracket Online

Página HTML estática que renderiza o chaveamento do campeonato lendo os resultados de uma planilha Google. Auto-refresh a cada 20s — todo mundo vê os placares atualizarem sem precisar dar reload.

**Formato:** 13 participantes. 12 jogam a 1ª fase em 6 confrontos. Time M tem bye direto pras quartas. Os 6 derrotados disputam a repescagem (3 fases) por 1 vaga nas quartas, que enfrenta o Time M na QF1.

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

## Setup em 6 passos

### 1. Criar a planilha Google

- Crie uma planilha nova com uma única aba chamada `Bracket`.
- Use exatamente estas colunas na primeira linha:

  | jogo_id | fase | jogador1 | clube1 | placar1 | jogador2 | clube2 | placar2 | vencedor | status |
  | ------- | ---- | -------- | ------ | ------- | -------- | ------ | ------- | -------- | ------ |

- Copie as 18 linhas do arquivo [`sample.csv`](sample.csv) (Arquivo → Importar → Substituir planilha).
- Os valores válidos para `status` são: `a_definir`, `ao_vivo`, `finalizado`.
- As fases válidas são: `primeira`, `repescagem_f1`, `repescagem_f2`, `repescagem_final`, `quartas`, `semis`, `final`.
- **IMPORTANTE — Time M (bye):** a linha `QF1` já tem `jogador1` = "Jogador M" no `sample.csv`. Logo após o sorteio inicial, troque "Jogador M" pelo nome real do jogador com bye e preencha `clube1` do `QF1` com o clube dele. O jogador2 da QF1 é auto-preenchido (vencedor da repescagem).
- **Clubes válidos** (use exatamente esses nomes nas colunas `clube1`/`clube2` para o escudo aparecer):

  **5★** — `Real Madrid`, `Barcelona`, `PSG`, `Bayern de Munique`, `Liverpool`, `Arsenal`, `Manchester City`, `Inter de Milão`

  **4,5★** — `Atlético de Madrid`, `Napoli`, `Borussia Dortmund`, `Milan`, `Newcastle United`, `Tottenham`, `Juventus`, `RB Leipzig`, `Bayer Leverkusen`, `Chelsea`, `Manchester United`

  **4★** — `Galatasaray`

- **Dica:** no Sheets, selecione as colunas `clube1` e `clube2` → **Dados → Validação de dados → Lista de itens** e cole os 20 nomes acima. Assim você escolhe pelo dropdown e não erra a grafia.

### 2. Publicar a planilha como CSV

- Na planilha: **Arquivo → Compartilhar → Publicar na web**.
- Em "Link", escolha a aba `Bracket` e formato **CSV**.
- Clique em **Publicar** e copie a URL gerada (formato `https://docs.google.com/spreadsheets/d/e/.../pub?output=csv`).

### 3. Configurar a URL no `app.js`

Abra [`app.js`](app.js) e cole a URL na constante `SHEET_CSV_URL`:

```js
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/.../pub?output=csv";
```

### 4. Subir para o GitHub

```bash
git init
git add .
git commit -m "Campeonato FIFA TD - bracket inicial"
git branch -M main
git remote add origin https://github.com/<seu-user>/campeonato-fifa-td.git
git push -u origin main
```

### 5. Ativar GitHub Pages

- No repo: **Settings → Pages → Source: Deploy from a branch → main → / (root)**.
- Aguarde 1-2 min. O link público fica em `https://<seu-user>.github.io/campeonato-fifa-td/`.

### 6. Compartilhar o link com a galera

Pronto. Manda no grupo e qualquer pessoa vê o bracket atualizar em tempo real conforme você edita a planilha.

## Como atualizar resultados durante o torneio

### Fluxo básico
1. Abra a planilha (de preferência pelo app Google Sheets no celular).
2. Depois do sorteio inicial, preencha as colunas `jogador1`/`clube1` e `jogador2`/`clube2` das linhas `J1` a `J6` — o escudo aparece na tela ao lado do nome do jogador.
3. Quando começar um jogo, mude o `status` da linha para `ao_vivo` — o card pulsa em roxo na tela de todo mundo.
4. Conforme rolam os gols, atualize `placar1` e `placar2`.
5. Ao fim do jogo, mude o `status` para `finalizado`. O vencedor é detectado automaticamente (maior placar).

### Empates (decisão por pênaltis / outro critério)

Se o jogo terminar empatado (ex: 1×1) e for decidido por pênaltis ou outro critério extra, preencha a coluna **`vencedor`** com `1` ou `2` (referente ao `jogador1` ou `jogador2`).

- A coluna `vencedor` **sobrescreve** a detecção automática pelo placar — útil também se quiser forçar manualmente um resultado.
- Quando você marca um empate como finalizado e preenche `vencedor`, o card mostra "finalizado · decisão" no cabeçalho.
- O **saldo de gols** desse jogo continua sendo 0 (porque os placares são iguais), então tanto o vencedor quanto o perdedor desse jogo entram no critério de desempate com saldo 0 — gols marcados e ordem na planilha viram os próximos critérios.

### Modo "planilha é a verdade" (atual)

A constante `AUTO_DERIVE` em [`app.js`](app.js) está em `false`. Ou seja: **a página espelha 100% o que está na planilha**, sem aplicar nenhuma regra de propagação automática entre fases.

Esse modo foi adotado porque o formato real pode mudar no meio do torneio (gente que precisa sair mais cedo, troca de chaveamento, etc). Ter a planilha como fonte única de verdade evita conflitos.

**Você precisa preencher manualmente:**

- `jogador1`/`clube1`/`jogador2`/`clube2` de **TODAS** as linhas (J1–J6, RP1–RP3, RF1, FR, QF1–QF4, SF1, SF2, FINAL)
- `placar1`, `placar2`, `status` conforme os jogos acontecem
- `vencedor` (1 ou 2) em caso de empate decidido por pênaltis

**O que o JS ainda faz sozinho:**

- Detecta vencedor pelo placar (ou pela coluna `vencedor`)
- Calcula o ranking dos derrotados (sidebar) — saldo → gols → ordem na planilha
- Marca vencedor visualmente no card

### Como reativar a auto-propagação

Se quiser voltar pro modo automático em algum torneio futuro, é só trocar:

```js
const AUTO_DERIVE = false;  →  const AUTO_DERIVE = true;
```

A lógica original continua intacta no código (função `deriveMatches`), só não é chamada quando o flag está em `false`.

### Sorteio das quartas

A [página de sorteio](sorteio.html) continua funcionando independente do `AUTO_DERIVE`. Ela lê os 6 vencedores da 1ª fase e sorteia QF2, QF3 e QF4 com animação — depois você copia o resultado pra planilha.

## Página de sorteio (`sorteio.html`)

Página separada com animação tipo slot machine pra sortear as quartas:

- Lê os 6 vencedores da 1ª fase da mesma planilha
- Mostra a QF1 já definida (Time M × Vencedor da Repescagem)
- Botão grande "SORTEAR QF2, QF3 e QF4" — clica e roda a animação
- Cada slot fica girando ~2s e revela o nome com efeito de pop
- Depois mostra a lista pronta pra copiar pra planilha
- Botão "sortear de novo" caso queira refazer

Antes de todos os 6 jogos da 1ª fase estarem `finalizado`, a página mostra "aguardando" e lista quais jogos faltam.

## Estrutura dos arquivos

```
campeonato-fifa-td/
├── index.html        # bracket principal
├── style.css         # paleta TD B2B + layout responsivo
├── app.js            # fetch da planilha + render + auto-refresh
├── sorteio.html      # página dedicada de sorteio das quartas
├── sorteio.css       # estilos do sorteio
├── sorteio.js        # animação do sorteio + lógica
├── sample.csv        # planilha-modelo (importar no Google Sheets)
├── README.md         # este arquivo
└── assets/
    ├── logo-TD.png
    ├── logo-TD-branco.png
    └── clubs/        # 20 escudos PNG dos clubes FIFA
        ├── real-madrid.png
        ├── barcelona.png
        └── ... (mais 18)
```

Escudos baixados do repo público [luukhopman/football-logos](https://github.com/luukhopman/football-logos).

## Paleta TD B2B aplicada

| Cor | Hex | Uso |
| --- | --- | --- |
| Black | `#020406` | fundo principal |
| Purple | `#A683E8` | destaque, vencedor, "ao vivo" |
| Light Blue | `#A1BFF6` | acentos, links, "finalizado" |
| Sakura | `#E9D5ED` | (reserva) |
| White | `#EAECEF` | texto |

## Dúvidas comuns

**O placar não está atualizando.** Pode ser cache do Google (~1-2min em horários de pico). Recarregue a página ou clique em "atualizar agora" no rodapé.

**Como faço para mudar um nome de time depois?** Edita direto a célula na planilha. A página puxa a mudança em até 20s.

**Quero rodar localmente para testar.** Deixe `SHEET_CSV_URL = ""` no `app.js` e abra `index.html` via um servidor estático (ex: `npx serve` ou extensão Live Server do VSCode). Ele vai usar o `sample.csv` local.

**Posso ter mais de um admin?** Sim — qualquer pessoa com permissão de edição na planilha pode atualizar. Sheets resolve conflitos automaticamente.
