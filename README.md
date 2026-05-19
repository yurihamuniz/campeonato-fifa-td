# Campeonato FIFA TD — Bracket Online

Página HTML estática que renderiza o chaveamento do campeonato lendo os resultados de uma planilha Google. Auto-refresh a cada 20s — todo mundo vê os placares atualizarem sem precisar dar reload.

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

  | jogo_id | fase | jogador1 | clube1 | placar1 | jogador2 | clube2 | placar2 | status |
  | ------- | ---- | -------- | ------ | ------- | -------- | ------ | ------- | ------ |

- Copie as 17 linhas do arquivo [`sample.csv`](sample.csv) (Arquivo → Importar → Substituir planilha).
- Os valores válidos para `status` são: `a_definir`, `ao_vivo`, `finalizado`.
- As fases válidas são: `primeira`, `repescagem_f1`, `repescagem_final`, `quartas`, `semis`, `final`.
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

1. Abra a planilha (de preferência pelo app Google Sheets no celular).
2. Depois do sorteio inicial, preencha as colunas `jogador1`/`clube1` e `jogador2`/`clube2` das linhas `J1` a `J6` — o escudo aparece na tela ao lado do nome do jogador.
3. Quando começar um jogo, mude o `status` da linha para `ao_vivo` — o card pulsa em roxo na tela de todo mundo.
4. Conforme rolam os gols, atualize `placar1` e `placar2`.
5. Ao fim do jogo, mude o `status` para `finalizado`. O vencedor é detectado automaticamente (maior placar).
6. Quando todos os 6 jogos da 1ª fase estiverem `finalizado`, o ranking dos derrotados aparece na lateral com escudo + nome, ordenado por **saldo de gols → gols marcados → ordem na planilha**.
7. Use o ranking para decidir os confrontos da repescagem e preencha `jogador1`/`clube1`/`jogador2`/`clube2` das linhas `RP1`, `RP2`, etc.
8. Mesma lógica vale para as quartas, semis e final (preencher após o sorteio).

## Estrutura dos arquivos

```
campeonato-fifa-td/
├── index.html        # estrutura do bracket
├── style.css         # paleta TD B2B + layout responsivo
├── app.js            # fetch da planilha + render + auto-refresh
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
