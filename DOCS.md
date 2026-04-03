# Controle NF + Caixa — Documentação do Projeto

## Visão Geral

App Electron para gestão financeira de empresas brasileiras com múltiplas unidades. Controla notas fiscais de fornecedores (com parcelamento, vencimento, pagamento), acerto de caixa diário e relatórios de custo.

**Stack:** Electron 31 + React 18 + TypeScript + SQLite (better-sqlite3) + Tailwind CSS + electron-vite

---

## Como Rodar

```bash
npm install
npm run dev          # modo desenvolvimento
npm run build        # build para produção
npm run build:mac    # gera DMG para macOS
npm run build:win    # gera instalador Windows (NSIS)
```

---

## Estrutura de Arquivos

```
Controle NF_Caixa/
├── electron/                        # Processo principal (Node.js)
│   ├── main.ts                      # Todos os handlers IPC
│   ├── preload.ts                   # Bridge contextBridge → window.api
│   ├── database/
│   │   ├── db.ts                    # Singleton SQLite (WAL mode, FK ativo)
│   │   ├── migrations.ts            # Criação e ALTER de tabelas (idempotente)
│   │   └── queries/
│   │       ├── cadastros.ts         # Empresas, unidades, CC, fornecedores, funcionários
│   │       ├── nf.ts                # NF: list/get/create/update + parcelas + programação + stats
│   │       ├── nfAnexos.ts          # Anexos de NF (PDF/imagens)
│   │       ├── caixa.ts             # Caixas + lançamentos + refeições
│   │       ├── relatorios.ts        # Relatórios de custo (CRUD de filtros salvos)
│   │       ├── settings.ts          # SMTP e outras configurações
│   │       ├── sefaz.ts             # NF-e SEFAZ (empresas, notas, destinatários)
│   │       ├── nfse.ts              # NFS-e ADN/BHISS (servicos, inserir, list com filtros)
│   │       └── tributos.ts          # Lucro Presumido: premissas + histórico trimestral
│   ├── email/
│   │   ├── sender.ts                # nodemailer + workaround DNS do macOS/Electron
│   │   ├── sefazSender.ts           # Envio de NF-e/NFS-e por e-mail
│   │   └── pdfMerge.ts              # Merge PDF da NF com anexos
│   ├── sefaz/                       # Integração SEFAZ NF-e
│   │   ├── consulta.ts              # Webservice de distribuição de documentos
│   │   └── manifestacao.ts          # Ciência da operação
│   ├── nfse/                        # Integração ADN NFS-e
│   │   └── consulta.ts              # API ADN + BHISS; determina tipo emitida/recebida
│   └── bhiss/                       # Integração legada BHISS (BH)
├── src/                             # Renderer (React)
│   ├── App.tsx                      # Shell: abas, titlebar, zoom (70-150%), tema dark/light
│   ├── main.tsx                     # ReactDOM.createRoot
│   ├── types.ts                     # Interfaces TypeScript (Empresa, NF, Caixa, etc.)
│   ├── index.css                    # Tailwind + estilos customizados
│   ├── lib/
│   │   ├── api.ts                   # Wrapper tipado sobre window.api (IPC)
│   │   └── format.ts                # Formatação de data/moeda + isVencido/isVencendoHoje
│   ├── components/
│   │   ├── Modal.tsx
│   │   ├── SearchableSelect.tsx     # Select com busca (usado em fornecedores, etc.)
│   │   ├── CurrencyInput.tsx        # Input de valor monetário formatado (pt-BR)
│   │   ├── ConfirmDialog.tsx
│   │   └── EmptyState.tsx
│   └── pages/
│       ├── nf/
│       │   ├── NFList.tsx           # Lista NF: filtros, quick filters (3/7/15/30 dias), stats
│       │   ├── NFForm.tsx           # Criar/editar NF + parcelas + programação + anexos
│       │   ├── NFPrint.tsx          # Modal de impressão
│       │   └── NFEmailModal.tsx     # Modal de envio por e-mail
│       ├── caixa/
│       │   ├── CaixaList.tsx
│       │   ├── CaixaForm.tsx
│       │   ├── CaixaDetail.tsx      # Caixa aberto: lançamentos + refeições por funcionário
│       │   ├── CaixaPrint.tsx
│       │   └── RefeicoesMes.tsx     # Grid mensal de refeições (31 colunas × funcionários)
│       ├── sefaz/
│       │   ├── SefazPage.tsx        # Shell com sub-abas: NF-e | NFS-e | Impostos | Empresas
│       │   ├── NfeMonitorPage.tsx   # Lista NF-e recebidas SEFAZ
│       │   ├── NfseServicosPage.tsx # Lista NFS-e (emitidas/recebidas) com filtro de tipo
│       │   ├── TributosPage.tsx     # Calculadora Lucro Presumido + histórico trimestral
│       │   └── SefazEmpresasPage.tsx
│       ├── relatorios/
│       │   ├── RelatorioList.tsx
│       │   └── RelatorioModal.tsx   # Filtros avançados + gráficos
│       ├── config/
│       │   ├── ConfigPage.tsx       # Sidebar de configurações
│       │   ├── EmpresasConfig.tsx
│       │   ├── UnidadesConfig.tsx
│       │   ├── CentrosCustoConfig.tsx
│       │   ├── FornecedoresConfig.tsx
│       │   ├── FuncionariosConfig.tsx
│       │   ├── EmailConfig.tsx      # SMTP + imagem de assinatura + senha de autorização
│       │   ├── BackupConfig.tsx     # Backup/restauração + importação de cadastros
│       │   └── NumeracaoConfig.tsx
│       └── manual/                  # Manual do usuário embutido
├── build/                           # Ícones (icon.icns, icon.ico)
├── package.json
├── electron.vite.config.ts
├── electron-builder.yml
├── tailwind.config.js
└── tsconfig*.json
```

---

## Banco de Dados

Localização (macOS): `~/Library/Application Support/controle-nf-caixa/controle-nf.db`

### Tabelas

#### `empresas`
CNPJ, nome, dados básicos. Cada empresa tem N unidades.

#### `unidades`
| Coluna | Descrição |
|--------|-----------|
| empresa_id FK | → empresas |
| nome, codigo | Identificação da unidade |

#### `centros_custo`
| Coluna | Descrição |
|--------|-----------|
| codigo, descricao | Centro de custo (ex: "CC001 - Cozinha") |
| empresa_id FK | Ligado à empresa |

#### `fornecedores`
Dados completos: nome, CNPJ, telefone, e-mail, banco, agência, conta, PIX.

#### `funcionarios`
nome, cargo, ativo, email_senha (senha de autorização para envio de NF por e-mail).

#### `notas_fiscais` (tabela principal)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| numero_seq | INTEGER UNIQUE | Numeração sequencial interna |
| empresa_id, unidade_id, centro_custo_id, fornecedor_id | FK | Vínculos |
| numero_nf | TEXT | Número externo da NF |
| data_emissao, data_vencimento | TEXT | Datas |
| valor_total | REAL | Valor da NF |
| status | TEXT | `'pendente'`, `'pago'`, `'cancelado'` |
| forma_pagamento | TEXT | boleto, pix, transferencia, etc. |
| data_pagamento | TEXT | Preenchido ao marcar como pago |
| email_enviado | INTEGER | 0/1 |
| observacoes | TEXT | |

#### `nf_parcelas`
Parcelas de pagamento ligadas a uma NF: valor, vencimento, status individual.

#### `nf_programacao`
Programação de pagamento alternativa às parcelas: datas e valores planejados.

#### `nf_anexos`
Arquivos PDF/imagens vinculados à NF (armazenados como Base64 ou path).

#### `caixas`
Cabeçalho do acerto de caixa: unidade, data, saldo_anterior, saldo_final, status (aberto/fechado).

#### `caixa_lancamentos`
Lançamentos de débito/crédito dentro de um caixa, com saldo acumulado.

#### `refeicoes`
Grid de refeições por funcionário × mês: 31 colunas de dias + valor_unitário.

#### `relatorios_custo`
Presets salvos de filtros para relatórios: nome + JSON de critérios.

#### `sefaz_empresas`
Empresas cadastradas para consulta SEFAZ/NFS-e: CNPJ, certificado A1 (pfx_b64 + pfx_senha), UF, ambiente, NSU de controle.

#### `sefaz_nfes`
NF-es recebidas via SEFAZ: chave de acesso, NSU, fornecedor, valor, XML completo, status de pagamento, email_enviado.

#### `nfse_servicos`
NFS-e consultadas via API ADN/BHISS.

| Coluna | Descrição |
|--------|-----------|
| empresa_id | FK → sefaz_empresas |
| chave_acesso | Unique — evita duplicatas |
| tipo | `'emitida'` ou `'recebida'` — calculado comparando prestador_cnpj com empresa.cnpj |
| fonte | `'adn'` ou `'bhiss'` — origem da importação |
| competencia | Mês de competência (YYYY-MM) |
| prestador_cnpj/nome | Dados do prestador |
| valor_servicos | Valor da NFS-e |
| cancelada | 0/1 |
| email_enviado | 0/1 |

#### `tributos_premissas`
Uma linha por empresa. Criada automaticamente com defaults no primeiro acesso.

| Coluna | Default | Descrição |
|--------|---------|-----------|
| presuncao | 0.32 | % de presunção sobre faturamento |
| aliq_irpj | 0.15 | Alíquota IRPJ |
| aliq_adicional_ir | 0.10 | Adicional IR sobre base > limite |
| aliq_csll | 0.09 | Alíquota CSLL |
| limite_adicional | 60000 | Limite trimestral do adicional IR |
| aliq_pis | 0.0065 | Alíquota PIS |
| aliq_cofins | 0.03 | Alíquota COFINS |
| aliq_irrf | 0.015 | IRRF retido pelo tomador |
| aliq_csll_retida | 0.01 | CSLL retida pelo tomador |
| pis_cofins_retidos | 1 | 1 = PIS/COFINS 100% retidos na fonte (DARF = R$0) |

#### `tributos_historico`
Um registro por empresa × trimestre (`UNIQUE empresa_id, ano, trimestre`). Upsert via `INSERT OR REPLACE`.

| Coluna | Descrição |
|--------|-----------|
| fat_mes1/2/3, fat_total | Faturamento por mês e total |
| base_irpj | fat_total × presuncao |
| irpj_bruto, adicional_ir, irrf_retido, irpj_a_recolher | Decomposição IRPJ |
| csll_bruto, csll_retida, csll_a_recolher | Decomposição CSLL |
| pis, cofins | Valores apurados (gross — independe de retenção) |
| total_tributos | Total a recolher via DARF (IRPJ + CSLL + pis/cofins_a_pagar) |
| carga_efetiva | (IRPJ + CSLL + PIS + COFINS) / fat_total |

#### `settings`
Chave-valor. Principais chaves:
- `email_smtp_host`, `email_smtp_port`, `email_smtp_secure`
- `email_smtp_user`, `email_smtp_pass`, `email_from`
- `email_to_padrao` (destinatário padrão)
- `email_senha_assinatura` (senha para autorizar envio)
- `email_signature_image` (imagem em base64)

---

## API IPC (window.api via preload)

### Cadastros
```typescript
api.empresas.list() / create(data) / update(id,data) / delete(id)
api.unidades.list() / listByEmpresa(empresaId) / create / update / delete
api.centrosCusto.list() / create / update / delete
api.fornecedores.list() / get(id) / create / update / delete
api.funcionarios.list() / create / update / delete
```

### Notas Fiscais
```typescript
api.nf.list(filtros)           // filtros: empresa_id, unidade_id, cc_id, fornecedor_id,
                               //          status, data_de, data_ate, busca
api.nf.get(id)
api.nf.create(data)
api.nf.update(id, data)
api.nf.delete(id)
api.nf.marcarPago(id, dataPagamento)
api.nf.desfazerPagamento(id)
api.nf.duplicate(id)           // Clona a NF sem data de pagamento
api.nf.getParcelas(nfId)
api.nf.saveParcelas(nfId, parcelas)
api.nf.getProgramacao(nfId)
api.nf.saveProgramacao(nfId, programacao)
api.nf.getMinSeq()             // Próximo número sequencial
api.nf.stats(filtros)          // { vencidos, vencendoHoje, totalAPagar, totalPago }
api.nf.exportExcel(filtros)    // Salva arquivo via dialog
api.nf.getAnexos(nfId)
api.nf.saveAnexos(nfId, anexos)
api.nf.deleteAnexo(id)
api.nf.pickAnexos()            // File picker → array de { nome, base64 }
```

### Caixa
```typescript
api.caixa.list(filtros)
api.caixa.get(id)
api.caixa.create(data)
api.caixa.update(id, data)
api.caixa.delete(id)
api.caixa.fechar(id)
api.caixa.reabrir(id)
api.caixa.getLancamentos(caixaId)
api.caixa.createLancamento(data)
api.caixa.updateLancamento(id, data)
api.caixa.deleteLancamento(id)
api.caixa.getRefeicoes(caixaId)
api.caixa.upsertRefeicao(data)
api.caixa.getTotalRefeicoes(params)
api.caixa.exportExcel(filtros)
```

### E-mail
```typescript
api.email.test()                           // Testa conexão SMTP
api.email.sendNF({ to, html, nfSeq, nfId }) // Envia NF com PDF gerado + anexos
api.email.validatePassword(senha)          // Verifica senha de autorização
```

### Monitor SEFAZ (NF-e)
```typescript
api.sefaz.empresas.list() / create(data) / update(id,data) / delete(id) / pickPfx()
api.sefaz.nfes.list(filtros)
api.sefaz.nfes.buscarXml(id)
api.sefaz.nfes.togglePagamento(id)
api.sefaz.nfes.marcarEmailEnviado(id)
api.sefaz.nfes.exportarNF(payload)   // Exporta NF-e para Controle de NF
api.sefaz.consultar(empresaId)        // Consulta webservice SEFAZ
api.sefaz.email.enviar(dados)
api.sefaz.destinatarios.list() / create(nome, email) / delete(id)
api.sefaz.onProgress(cb)             // Listener de progresso (IPC event)
```

### Monitor NFS-e (ADN Nacional)
```typescript
api.nfse.servicos.list(filtros)          // filtros: empresa_id, tipo, fonte, competencia, busca
api.nfse.servicos.anosDisponiveis(empresaId)
api.nfse.servicos.buscarXml(id)
api.nfse.servicos.togglePagamento(id)
api.nfse.servicos.marcarEmailEnviado(id)
api.nfse.consultar(empresaId)            // Busca NFS-e na API ADN; determina tipo emitida/recebida
api.nfse.reimportar(empresaId)           // Reprocessa todas as NFS-e do zero
api.nfse.verificarEventos(empresaId)
api.nfse.exportarNF(payload)             // Exporta NFS-e recebida para Controle de NF
api.nfse.onProgress(cb)                  // Listener de progresso (IPC event)
```

### Tributos (Lucro Presumido)
```typescript
api.tributos.getPremissas(empresa_id)
  // → TributosPremissas (cria com INSERT OR IGNORE se não existir)
api.tributos.savePremissas(empresa_id, data)
api.tributos.getFaturamento(empresa_id, ano, trimestre)
  // → { mes1, mes2, mes3 } — soma valor_servicos de nfse_servicos WHERE tipo='emitida' AND fonte='adn'
api.tributos.salvarTrimestre(data)
  // INSERT OR REPLACE INTO tributos_historico
api.tributos.getHistorico(empresa_id)
  // → TributosHistorico[] ORDER BY ano DESC, trimestre DESC
api.tributos.getHistoricoTrimestre(empresa_id, ano, trimestre)
  // → TributosHistorico | undefined
api.tributos.deleteHistorico(id)
```

### Backup
```typescript
api.backup.export(modulo?)        // Exporta banco completo ou por módulo
api.backup.pickFile()             // Seleciona arquivo .db/.sqlite
api.backup.restore(filePath)      // Restaura backup (reinicia o app)
api.cadastros.export()            // Exporta JSON: empresas, unidades, CC, funcionários
api.cadastros.analyze(filePath)   // Detecta conflitos no JSON importado
api.cadastros.importConfirmed(filePath, decisions) // Importa com resolução de conflitos
```

### Configurações
```typescript
api.settings.get(key)
api.settings.set(key, value)
api.settings.pickImage()     // File picker PNG/JPG → base64
```

---

## Fluxo de Envio de E-mail

1. NFList → botão e-mail → `NFEmailModal` (pede e-mail destinatário + valida senha de autorização)
2. `api.email.sendNF()` → IPC `email:sendNF`
3. `main.ts`:
   - Cria `BrowserWindow` oculta → carrega HTML da NF → `printToPDF()`
   - `pdfMerge.ts`: merge do PDF gerado com anexos salvos
   - `sender.ts`: nodemailer com **workaround DNS do macOS** (Electron bloqueia `getaddrinfo`, resolve via `dns.resolve4()` → conecta por IP com SNI override)
4. `nf:markEmailEnviado(id)` → `email_enviado = 1`
5. Ícone de e-mail fica verde na lista

---

## Workaround DNS no macOS (sender.ts)

O Electron no macOS bloqueia `getaddrinfo`. Solução implementada:
```typescript
async function resolveHost(hostname: string): Promise<string> {
  return new Promise((resolve, reject) => {
    dns.resolve4(hostname, (err, addresses) => {
      if (err) reject(err)
      else resolve(addresses[0])
    })
  })
}
// Usa o IP resolvido mas mantém servername para TLS
transporter = nodemailer.createTransport({
  host: resolvedIp,
  tls: { servername: originalHostname }
})
```

---

## Features da UI

- **Tema dark/light** — toggle no titlebar, persiste em localStorage
- **Zoom 70-150%** — ajuste no titlebar via CSS `zoom`, persiste em localStorage
- **Titlebar customizado** — `hiddenInset` no macOS (traffic lights nativos) + botões próprios no Windows
- **SearchableSelect** — dropdown com busca textual (usado em fornecedores, unidades, etc.)
- **Quick-create inline** — criar fornecedor ou centro de custo sem sair do NFForm
- **Quick filters** — botões "3/7/15/30 dias" na NFList para filtro rápido de vencimento
- **Stats bar** — cartões "Vencidas", "Vencem hoje", "Total a pagar" acima da lista de NFs

---

## Módulo Monitor NF — Documentação Detalhada

O módulo **Monitor NF** é acessado pela aba "Monitor NF-e" na navegação principal (`App.tsx`). Internamente usa sub-abas gerenciadas por `SefazPage.tsx`:

| Sub-aba | Componente | Descrição |
|---------|-----------|-----------|
| NF-es Recebidas | `SefazNFesPage.tsx` | Documentos fiscais eletrônicos (NF-e) obtidos via webservice SEFAZ |
| NFS-e Tomadas | `NfseServicosPage.tsx` | Notas de Serviço eletrônicas (NFS-e) via API ADN Nacional |
| Impostos | `TributosPage.tsx` | Calculadora trimestral de tributos — Lucro Presumido |
| Empresas SEFAZ | `SefazEmpresasPage.tsx` | Cadastro de certificados digitais A1 por empresa |
| Destinatários | `SefazDestinatariosPage.tsx` | Lista de e-mails para envio de documentos fiscais |

---

### 1. NF-es Recebidas (SEFAZ)

**Componente:** `src/pages/sefaz/SefazNFesPage.tsx`  
**Queries:** `electron/database/queries/sefaz.ts` — `sefazNfesQueries`  
**Integração:** `electron/sefaz/consulta.ts` + `electron/sefaz/manifestacao.ts`

#### Como funciona

1. O usuário seleciona uma empresa cadastrada em Empresas SEFAZ.
2. Clica em **Consultar SEFAZ** → dispara `api.sefaz.consultar(empresaId)`.
3. O processo principal autentica com o certificado A1 (`.pfx`) da empresa e chama o webservice de **Distribuição de Documentos Fiscais** da SEFAZ.
4. As NF-es são baixadas em lotes a partir do último NSU registrado. A cada consulta, o `ultimo_nsu` da empresa é atualizado no banco.
5. Novos documentos são inseridos via `INSERT OR IGNORE` (evita duplicatas pela `chave_acesso`).
6. A manifestação de ciência da operação é feita automaticamente para cada NF-e recebida.

#### Rate limiting e cooldown

A SEFAZ limita a **19 consultas por dia** por empresa. O sistema:
- Registra cada consulta em `sefaz_consultas_count` / `sefaz_consultas_data`.
- Ao atingir o limite, ativa um cooldown de 65 minutos (`sefaz_cooldown_ate`).
- Erros específicos são traduzidos para mensagens amigáveis: senha errada, limite atingido, cooldown, sem conexão.

#### Tipos de documento

| `tipo_nfe` | Descrição |
|-----------|-----------|
| `procNFe` | XML completo da NF-e (nota autorizada) |
| `resNFe` | Resumo — XML completo ainda não disponível. Atualizado para `procNFe` quando a nota chega completa numa consulta subsequente |

#### Filtros disponíveis

- Fornecedor (nome ou CNPJ — busca livre)
- Período (data de emissão: de / até)
- Status de pagamento (todas / pendente / pago)
- E-mail (todas / enviadas / não enviadas)

#### Ações por NF-e

| Ação | Descrição |
|------|-----------|
| Visualizar | Exibe XML formatado com campos extraídos via regex (`getTagXml`) |
| Imprimir | Abre janela de impressão com dados da nota |
| Marcar pago/pendente | Toggle `status_pagamento` com data de pagamento |
| Enviar por e-mail | Modal com seleção de destinatários cadastrados; envia XML como anexo |
| Exportar para Controle de NF | Abre modal buscável (empresa / unidade / centro de custo); lê CNPJ do destinatário no XML para pré-preencher a empresa; cria fornecedor automaticamente se não existir; NF importada fica com status `'pendente'` |
| Download XML | Salva o arquivo `.xml` local via diálogo |

#### Tabela `sefaz_nfes`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `chave_acesso` | TEXT UNIQUE | Chave de 44 dígitos — controle de duplicatas |
| `nsu` | TEXT | NSU do documento na SEFAZ |
| `nf_numero` | TEXT | Número da NF-e |
| `nf_data` | TEXT | Data de emissão |
| `fornecedor_cnpj` | TEXT | CNPJ do emitente |
| `fornecedor_nome` | TEXT | Nome do emitente |
| `valor_nota` | REAL | Valor total |
| `status_pagamento` | TEXT | `'pendente'` ou `'pago'` |
| `data_pagamento` | TEXT | Preenchido ao marcar como pago |
| `email_enviado` | INTEGER | 0/1 |
| `xml_blob` | TEXT | XML completo armazenado como texto |
| `tipo_nfe` | TEXT | `'procNFe'` ou `'resNFe'` |

---

### 2. NFS-e Tomadas — ADN Nacional

**Componente:** `src/pages/sefaz/NfseServicosPage.tsx`  
**Queries:** `electron/database/queries/nfse.ts` — `nfseServicosQueries`  
**Integração:** `electron/nfse/consulta.ts`

#### Como funciona

1. O usuário seleciona a empresa e clica em **Consultar ADN**.
2. O processo principal usa o certificado A1 da empresa para autenticar na **API ADN Nacional** (portal nacional de NFS-e).
3. A API retorna **todas** as NFS-e vinculadas ao CNPJ — tanto emitidas (empresa como prestador) quanto recebidas (empresa como tomador).
4. Cada nota é classificada automaticamente como `emitida` ou `recebida` ao ser inserida.
5. Importação paginada: busca todos os NSUs disponíveis até não haver mais documentos.

#### Lógica de classificação Emitida/Recebida

```
tipo = 'emitida' SE prestador_cnpj.replace(/\D/g, '') === empresa.cnpj.replace(/\D/g, '')
tipo = 'recebida' EM TODOS OS OUTROS CASOS
```

O cálculo é feito no handler `nfse:consultar` em `electron/main.ts` antes de cada `inserir()`. A coluna `tipo` é persistida no banco e reclassificada a cada reimportação.

**Backfill de registros antigos:** a migration em `electron/database/migrations.ts` executa um `UPDATE` fora do `try/catch` a cada startup para reclassificar registros existentes que ainda não tinham `tipo` correto.

#### Coluna Fonte

| `fonte` | Origem |
|---------|--------|
| `'adn'` | API ADN Nacional — fonte principal e única usada para cálculos de faturamento |
| `'bhiss'` | BHISS (sistema legado BH) — fonte obsoleta; não é usada em cálculos para evitar duplicatas |

> **Importante:** A mesma NFS-e pode aparecer nas duas fontes com números diferentes (ex.: BHISS: `2500000000019/00001`, ADN: `1/900`). Por isso o cálculo de faturamento da calculadora de impostos usa **exclusivamente** `fonte = 'adn'`.

#### Badges de Tipo

| Tipo | Badge | Cor |
|------|-------|-----|
| Emitida | `Emitida` | Violeta — `bg-violet-500/20 text-violet-300` |
| Recebida | `Recebida` | Azul — `bg-blue-500/20 text-blue-300` |

#### Filtros disponíveis

- Prestador (nome ou CNPJ)
- Ano / Competência (mês/ano)
- Status de pagamento
- Fonte (ADN / BHISS / todas)
- Tipo (todas / emitidas / recebidas)

#### Ações por NFS-e

| Ação | Disponível para | Descrição |
|------|----------------|-----------|
| Visualizar | Todas | Dados da NFS-e extraídos do XML armazenado |
| Imprimir | Todas | Impressão dos dados |
| Marcar pago/pendente | Todas | Toggle de status com data |
| Enviar por e-mail | Todas | Envia XML por e-mail com destinatários selecionáveis |
| Exportar para Controle de NF | **Apenas recebidas** | Pré-preenche fornecedor pelo CNPJ do prestador; NF importada fica com status `'pendente'` |
| Verificar eventos | Empresa | Verifica cancelamentos via API ADN |
| Reimportar | Empresa | Apaga todos os registros e reprocessa do zero; recalcula tipos |

#### Tabela `nfse_servicos`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `chave_acesso` | TEXT UNIQUE | Evita duplicatas por nota |
| `nsu` | TEXT | NSU na API ADN |
| `numero` / `serie` | TEXT | Número e série da NFS-e |
| `competencia` | TEXT | Formato `YYYY-MM` |
| `prestador_cnpj` | TEXT | CNPJ do prestador de serviço |
| `prestador_nome` | TEXT | Nome do prestador |
| `valor_servicos` | REAL | Valor da nota |
| `descricao` | TEXT | Descrição do serviço |
| `tipo` | TEXT | `'emitida'` ou `'recebida'` |
| `fonte` | TEXT | `'adn'` ou `'bhiss'` |
| `cancelada` | INTEGER | 0 = ativa, 1 = cancelada |
| `email_enviado` | INTEGER | 0 / 1 |
| `xml_blob` | TEXT | XML completo armazenado como texto |

---

### 3. Impostos — Calculadora Trimestral (Lucro Presumido)

**Componente:** `src/pages/sefaz/TributosPage.tsx`  
**Queries:** `electron/database/queries/tributos.ts` — `tributosQueries`

#### Objetivo

Calcular automaticamente os tributos federais trimestrais (IRPJ, CSLL, PIS, COFINS) para empresas de serviço no regime de **Lucro Presumido**, com base nas NFS-e **emitidas** do período.

#### Fluxo de uso

1. Selecionar empresa + ano + trimestre.
2. O sistema busca o faturamento de cada mês do trimestre nas NFS-e emitidas (`fonte='adn'`, `tipo='emitida'`).
3. Se o trimestre já foi salvo anteriormente, carrega os valores do histórico (com aviso em amber) em vez dos valores das NFS-e.
4. O usuário pode editar os valores de faturamento manualmente.
5. Botão **Restaurar valores das NFS-e** (ícone RotateCcw): desfaz edições manuais e volta aos valores calculados das NFS-e.
6. Cálculo em tempo real — qualquer edição atualiza os resultados instantaneamente.
7. Botão **Premissas** → modal para editar alíquotas por empresa.
8. Botão **Salvar Trimestre** → persiste no histórico (`INSERT OR REPLACE`).
9. Histórico sempre visível abaixo da calculadora (com estado vazio se não houver registros).

#### Fórmulas de cálculo

```typescript
const fat = fat1 + fat2 + fat3
const base = fat * p.presuncao                               // base de presunção
const irpj_bruto = base * p.aliq_irpj                       // 15% sobre a base
const adicional = Math.max(0, base - p.limite_adicional) * p.aliq_adicional_ir  // 10% s/ excedente
const irrf = fat * p.aliq_irrf                              // IRRF retido pelo tomador
const irpj_recolher = Math.max(0, irpj_bruto + adicional - irrf)

const csll_bruto = base * p.aliq_csll                       // 9% sobre a base
const csll_ret = fat * p.aliq_csll_retida                   // CSLL retida pelo tomador
const csll_recolher = Math.max(0, csll_bruto - csll_ret)

const pis = fat * p.aliq_pis                                // apurado (0,65%)
const cofins = fat * p.aliq_cofins                          // apurado (3%)

// Quando pis_cofins_retidos = 1: não entram no DARF
const pis_a_pagar = p.pis_cofins_retidos ? 0 : pis
const cofins_a_pagar = p.pis_cofins_retidos ? 0 : cofins

const total_tributos = irpj_recolher + csll_recolher + pis_a_pagar + cofins_a_pagar
const carga_efetiva = fat > 0 ? (irpj_recolher + csll_recolher + pis + cofins) / fat : 0
```

> **Carga efetiva** sempre inclui PIS+COFINS mesmo quando retidos, pois representam custo real mesmo que não gerem DARF.

#### PIS/COFINS retidos na fonte

Quando `pis_cofins_retidos = 1` (padrão para empresas de serviço):
- Os valores apurados de PIS e COFINS são **exibidos como referência** na interface.
- Um badge verde indica `"100% retidos na fonte — DARF: R$ 0,00"`.
- Apenas IRPJ + CSLL compõem o **Total a Recolher (DARF)**.

#### Premissas por empresa

Armazenadas em `tributos_premissas` (uma linha por empresa, criada com `INSERT OR IGNORE` no primeiro acesso):

| Campo | Default | Descrição |
|-------|---------|-----------|
| `presuncao` | 32% | Percentual de presunção sobre o faturamento |
| `aliq_irpj` | 15% | Alíquota IRPJ |
| `aliq_adicional_ir` | 10% | Adicional IR sobre base que exceder `limite_adicional` |
| `aliq_csll` | 9% | Alíquota CSLL |
| `limite_adicional` | R$ 60.000 | Teto trimestral da base para o adicional IR |
| `aliq_pis` | 0,65% | Alíquota PIS (cumulativo) |
| `aliq_cofins` | 3% | Alíquota COFINS (cumulativo) |
| `aliq_irrf` | 1,5% | IRRF retido pelo tomador sobre o faturamento |
| `aliq_csll_retida` | 1% | CSLL retida pelo tomador sobre o faturamento |
| `pis_cofins_retidos` | 1 | 1 = PIS/COFINS 100% retidos (DARF = R$0) |

#### Histórico trimestral

Tabela `tributos_historico` com `UNIQUE(empresa_id, ano, trimestre)`:
- Upsert via `INSERT OR REPLACE` — salvar o mesmo trimestre duas vezes sobrescreve.
- Campos salvos: faturamento por mês, todos os valores calculados (brutos, retenções, a recolher), total e carga efetiva.
- Ordenado por `ano DESC, trimestre DESC` na exibição.
- Ação **Excluir** por linha no histórico.

---

### 4. Empresas SEFAZ

**Componente:** `src/pages/sefaz/SefazEmpresasPage.tsx`  
**Queries:** `electron/database/queries/sefaz.ts` — `sefazEmpresasQueries`

Cada empresa cadastrada aqui é usada para autenticar nas APIs da SEFAZ (NF-e) e ADN (NFS-e).

| Campo | Descrição |
|-------|-----------|
| `nome` | Razão social |
| `cnpj` | CNPJ (usado para classificar tipo emitida/recebida nas NFS-e) |
| `uf` | UF da empresa |
| `pfx_b64` | Certificado digital A1 em Base64 (arquivo `.pfx`) |
| `pfx_senha` | Senha do certificado A1 |
| `ambiente` | `'producao'` ou `'homologacao'` |
| `ultimo_nsu` | Último NSU consultado na SEFAZ (controle de paginação NF-e) |
| `ultimo_nsu_nfse` | Último NSU consultado na ADN (controle de paginação NFS-e) |
| `sefaz_consultas_count` | Número de consultas no dia atual (SEFAZ tem limite de 19/dia) |
| `sefaz_consultas_data` | Data das consultas contadas |
| `sefaz_cooldown_ate` | Timestamp ISO de quando o cooldown expira |

---

### 5. Destinatários

**Componente:** `src/pages/sefaz/SefazDestinatariosPage.tsx`  
**Queries:** `electron/database/queries/sefaz.ts` — `sefazDestinatariosQueries`

Lista simples de nome + e-mail usada nos modais de envio de NF-e e NFS-e por e-mail. Exclusão lógica (`ativo = 0`).

---

### SearchableSelect — Componente interno

Usado nos modais de exportação (empresa, unidade, centro de custo) tanto em `SefazNFesPage` quanto em `NfseServicosPage`. Implementado inline em cada arquivo (não extraído para componente global). Funcionalidades:
- Dropdown com campo de busca embutido (abre `input` com `autoFocus`)
- Fechar ao clicar fora (`mousedown` listener no documento)
- Visual consistente com o resto da UI (Tailwind + dark theme)

---

## Guia de Implantação do Módulo Monitor NF (para outra IA ou desenvolvedor)

Este guia lista **exatamente o que precisa ser criado/modificado** para implantar o módulo Monitor NF do zero em um projeto Electron + React + TypeScript + better-sqlite3.

### Pré-requisitos no projeto base

- Electron com `ipcMain` / `ipcRenderer` / `contextBridge`
- better-sqlite3 com instância singleton (`getDb()`)
- React + Tailwind CSS

---

### Passo 1 — Migrations (`electron/database/migrations.ts`)

Adicionar as tabelas abaixo na função de migrations. Usar `CREATE TABLE IF NOT EXISTS` para idempotência.

```sql
-- Empresas com certificado digital A1
CREATE TABLE IF NOT EXISTS sefaz_empresas (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  uf TEXT DEFAULT '',
  pfx_b64 TEXT,
  pfx_senha TEXT,
  ambiente TEXT DEFAULT 'producao',
  ultimo_nsu TEXT DEFAULT '0',
  ultimo_nsu_nfse TEXT DEFAULT '0',
  sefaz_consultas_count INTEGER DEFAULT 0,
  sefaz_consultas_data TEXT DEFAULT '',
  sefaz_cooldown_ate TEXT DEFAULT '',
  ativo INTEGER DEFAULT 1
);

-- NF-es recebidas via SEFAZ
CREATE TABLE IF NOT EXISTS sefaz_nfes (
  id INTEGER PRIMARY KEY,
  empresa_id INTEGER NOT NULL,
  chave_acesso TEXT UNIQUE,
  nsu TEXT,
  nf_numero TEXT,
  nf_data TEXT,
  fornecedor_cnpj TEXT,
  fornecedor_nome TEXT,
  valor_nota REAL DEFAULT 0,
  status_pagamento TEXT DEFAULT 'pendente',
  data_pagamento TEXT,
  email_enviado INTEGER DEFAULT 0,
  xml_blob TEXT,
  tipo_nfe TEXT DEFAULT 'procNFe',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (empresa_id) REFERENCES sefaz_empresas(id)
);

-- Destinatários de e-mail
CREATE TABLE IF NOT EXISTS sefaz_destinatarios (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  ativo INTEGER DEFAULT 1
);

-- NFS-e via API ADN Nacional
CREATE TABLE IF NOT EXISTS nfse_servicos (
  id INTEGER PRIMARY KEY,
  empresa_id INTEGER NOT NULL,
  chave_acesso TEXT UNIQUE,
  nsu TEXT,
  numero TEXT,
  serie TEXT,
  competencia TEXT,
  prestador_cnpj TEXT,
  prestador_nome TEXT,
  valor_servicos REAL DEFAULT 0,
  descricao TEXT,
  status_pagamento TEXT DEFAULT 'pendente',
  data_pagamento TEXT,
  xml_blob TEXT,
  fonte TEXT DEFAULT 'adn',
  tipo TEXT DEFAULT 'recebida',
  cancelada INTEGER DEFAULT 0,
  email_enviado INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (empresa_id) REFERENCES sefaz_empresas(id)
);

-- Premissas tributárias por empresa (criadas on-demand)
CREATE TABLE IF NOT EXISTS tributos_premissas (
  id INTEGER PRIMARY KEY,
  empresa_id INTEGER NOT NULL UNIQUE,
  presuncao REAL DEFAULT 0.32,
  aliq_irpj REAL DEFAULT 0.15,
  aliq_adicional_ir REAL DEFAULT 0.10,
  aliq_csll REAL DEFAULT 0.09,
  limite_adicional REAL DEFAULT 60000,
  aliq_pis REAL DEFAULT 0.0065,
  aliq_cofins REAL DEFAULT 0.03,
  aliq_irrf REAL DEFAULT 0.015,
  aliq_csll_retida REAL DEFAULT 0.01,
  pis_cofins_retidos INTEGER DEFAULT 1,
  FOREIGN KEY (empresa_id) REFERENCES sefaz_empresas(id)
);

-- Histórico de trimestres calculados
CREATE TABLE IF NOT EXISTS tributos_historico (
  id INTEGER PRIMARY KEY,
  empresa_id INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  trimestre INTEGER NOT NULL,
  fat_mes1 REAL DEFAULT 0,
  fat_mes2 REAL DEFAULT 0,
  fat_mes3 REAL DEFAULT 0,
  fat_total REAL DEFAULT 0,
  base_irpj REAL DEFAULT 0,
  irpj_bruto REAL DEFAULT 0,
  adicional_ir REAL DEFAULT 0,
  irrf_retido REAL DEFAULT 0,
  irpj_a_recolher REAL DEFAULT 0,
  csll_bruto REAL DEFAULT 0,
  csll_retida REAL DEFAULT 0,
  csll_a_recolher REAL DEFAULT 0,
  pis REAL DEFAULT 0,
  cofins REAL DEFAULT 0,
  total_tributos REAL DEFAULT 0,
  carga_efetiva REAL DEFAULT 0,
  observacao TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(empresa_id, ano, trimestre),
  FOREIGN KEY (empresa_id) REFERENCES sefaz_empresas(id)
);
```

**Backfill obrigatório** — adicionar fora do `try/catch`, executado a cada startup:
```sql
-- Reclassifica NFS-e existentes onde o prestador é a própria empresa
UPDATE nfse_servicos SET tipo = 'emitida'
WHERE replace(replace(replace(prestador_cnpj,'.',''),'/',''),'-','') = (
  SELECT replace(replace(replace(cnpj,'.',''),'/',''),'-','')
  FROM sefaz_empresas WHERE sefaz_empresas.id = nfse_servicos.empresa_id
)
```

---

### Passo 2 — Queries (`electron/database/queries/`)

Criar três arquivos:

#### `sefaz.ts`
Exportar três objetos: `sefazEmpresasQueries`, `sefazNfesQueries`, `sefazDestinatariosQueries`.
- Empresas: `list`, `get`, `create`, `update`, `delete` (lógico: `ativo=0`), `atualizarNsu`, `atualizarNsuNfse`, `getEstadoRateLimit`, `registrarConsulta`, `ativarCooldown`, `limparCooldown`
- NF-es: `list(filtros)` com filtros dinâmicos, `inserir` (INSERT OR IGNORE), `atualizarCompleta` (resNFe → procNFe), `buscarXml`, `togglePagamento`, `marcarEmailEnviado`
- Destinatários: `list`, `create`, `delete` (lógico)

#### `nfse.ts`
Exportar `nfseServicosQueries`:
- `list(filtros)`: suporta filtros `empresa_id`, `prestador`, `ano`, `competencia`, `status_pagamento`, `fonte`, `tipo`
- `inserir`: INSERT OR IGNORE pelo `chave_acesso`
- `anosDisponiveis(empresaId)`: DISTINCT dos 4 primeiros chars da competência
- `buscarXml`, `togglePagamento`, `marcarCancelada`, `marcarEmailEnviado`
- `listarParaEventos`: SELECT das últimas 200 com chave numérica de 44 dígitos
- `deletarTodos(empresaId)`: usado no reimportar

#### `tributos.ts`
Exportar `tributosQueries`:
- `getPremissas(empresa_id)`: INSERT OR IGNORE + SELECT (auto-cria com defaults)
- `savePremissas(empresa_id, data)`: UPDATE todos os campos
- `getFaturamentoTrimestre(empresa_id, ano, trimestre)`: SUM de `valor_servicos` WHERE `tipo='emitida' AND fonte='adn'` por mês
- `salvarHistorico(data)`: INSERT OR REPLACE (upsert pelo UNIQUE)
- `getHistorico(empresa_id)`: ORDER BY ano DESC, trimestre DESC
- `getHistoricoTrimestre(empresa_id, ano, trimestre)`: linha única
- `deleteHistorico(id)`: DELETE físico

---

### Passo 3 — Handlers IPC (`electron/main.ts`)

Adicionar os seguintes `ipcMain.handle`:

```typescript
// Empresas SEFAZ
ipcMain.handle('sefaz:empresas:list', () => sefazEmpresasQueries.list())
ipcMain.handle('sefaz:empresas:create', (_, data) => sefazEmpresasQueries.create(data))
ipcMain.handle('sefaz:empresas:update', (_, id, data) => sefazEmpresasQueries.update(id, data))
ipcMain.handle('sefaz:empresas:delete', (_, id) => sefazEmpresasQueries.delete(id))
ipcMain.handle('sefaz:empresas:pickPfx', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ filters: [{ name: 'Certificado', extensions: ['pfx'] }] })
  if (canceled) return null
  return fs.readFileSync(filePaths[0]).toString('base64')
})

// NF-es SEFAZ
ipcMain.handle('sefaz:nfes:list', (_, filtros) => sefazNfesQueries.list(filtros))
ipcMain.handle('sefaz:nfes:buscarXml', (_, id) => sefazNfesQueries.buscarXml(id))
ipcMain.handle('sefaz:nfes:togglePagamento', (_, id) => sefazNfesQueries.togglePagamento(id))
ipcMain.handle('sefaz:nfes:marcarEmailEnviado', (_, id) => sefazNfesQueries.marcarEmailEnviado(id))
ipcMain.handle('sefaz:nfes:exportarNF', (_, payload) => { /* criar NF no Controle de NF */ })

// Consulta SEFAZ (com rate limiting e manifestação)
ipcMain.handle('sefaz:consultar', async (event, empresaId) => { /* chama electron/sefaz/consulta.ts */ })

// Destinatários
ipcMain.handle('sefaz:destinatarios:list', () => sefazDestinatariosQueries.list())
ipcMain.handle('sefaz:destinatarios:create', (_, nome, email) => sefazDestinatariosQueries.create(nome, email))
ipcMain.handle('sefaz:destinatarios:delete', (_, id) => sefazDestinatariosQueries.delete(id))

// NFS-e ADN
ipcMain.handle('nfse:servicos:list', (_, filtros) => nfseServicosQueries.list(filtros))
ipcMain.handle('nfse:servicos:anosDisponiveis', (_, empresaId) => nfseServicosQueries.anosDisponiveis(empresaId))
ipcMain.handle('nfse:servicos:buscarXml', (_, id) => nfseServicosQueries.buscarXml(id))
ipcMain.handle('nfse:servicos:togglePagamento', (_, id) => nfseServicosQueries.togglePagamento(id))
ipcMain.handle('nfse:servicos:marcarEmailEnviado', (_, id) => nfseServicosQueries.marcarEmailEnviado(id))
ipcMain.handle('nfse:consultar', async (event, empresaId) => {
  const empresa = sefazEmpresasQueries.get(empresaId)
  // Para cada NFS-e recebida da API ADN:
  const cnpjEmpresa = empresa.cnpj.replace(/\D/g, '')
  const tipo = s.prestador_cnpj.replace(/\D/g, '') === cnpjEmpresa ? 'emitida' : 'recebida'
  nfseServicosQueries.inserir({ ...s, tipo, fonte: 'adn' })
})
ipcMain.handle('nfse:reimportar', async (event, empresaId) => {
  nfseServicosQueries.deletarTodos(empresaId)
  // mesma lógica do consultar mas do zero
})
ipcMain.handle('nfse:verificarEventos', (_, empresaId) => { /* verifica cancelamentos ADN */ })
ipcMain.handle('nfse:exportarNF', (_, payload) => { /* criar NF no Controle de NF */ })

// Tributos
ipcMain.handle('tributos:getPremissas', (_, empresa_id) => tributosQueries.getPremissas(empresa_id))
ipcMain.handle('tributos:savePremissas', (_, empresa_id, data) => tributosQueries.savePremissas(empresa_id, data))
ipcMain.handle('tributos:getFaturamento', (_, empresa_id, ano, trimestre) => tributosQueries.getFaturamentoTrimestre(empresa_id, ano, trimestre))
ipcMain.handle('tributos:salvarTrimestre', (_, data) => tributosQueries.salvarHistorico(data))
ipcMain.handle('tributos:getHistorico', (_, empresa_id) => tributosQueries.getHistorico(empresa_id))
ipcMain.handle('tributos:getHistoricoTrimestre', (_, empresa_id, ano, trimestre) => tributosQueries.getHistoricoTrimestre(empresa_id, ano, trimestre))
ipcMain.handle('tributos:deleteHistorico', (_, id) => tributosQueries.deleteHistorico(id))
```

**Progresso em tempo real:** usar `event.sender.send('sefaz:progress', msg)` e `event.sender.send('nfse:progress', msg)` para enviar mensagens de andamento durante consultas longas.

---

### Passo 4 — Preload (`electron/preload.ts`)

Expor via `contextBridge.exposeInMainWorld('api', { ... })`:

```typescript
sefaz: {
  empresas: {
    list: () => ipcRenderer.invoke('sefaz:empresas:list'),
    create: (data) => ipcRenderer.invoke('sefaz:empresas:create', data),
    update: (id, data) => ipcRenderer.invoke('sefaz:empresas:update', id, data),
    delete: (id) => ipcRenderer.invoke('sefaz:empresas:delete', id),
    pickPfx: () => ipcRenderer.invoke('sefaz:empresas:pickPfx'),
  },
  nfes: {
    list: (filtros) => ipcRenderer.invoke('sefaz:nfes:list', filtros),
    buscarXml: (id) => ipcRenderer.invoke('sefaz:nfes:buscarXml', id),
    togglePagamento: (id) => ipcRenderer.invoke('sefaz:nfes:togglePagamento', id),
    marcarEmailEnviado: (id) => ipcRenderer.invoke('sefaz:nfes:marcarEmailEnviado', id),
    exportarNF: (payload) => ipcRenderer.invoke('sefaz:nfes:exportarNF', payload),
  },
  consultar: (empresaId) => ipcRenderer.invoke('sefaz:consultar', empresaId),
  email: { enviar: (dados) => ipcRenderer.invoke('sefaz:email:enviar', dados) },
  destinatarios: {
    list: () => ipcRenderer.invoke('sefaz:destinatarios:list'),
    create: (nome, email) => ipcRenderer.invoke('sefaz:destinatarios:create', nome, email),
    delete: (id) => ipcRenderer.invoke('sefaz:destinatarios:delete', id),
  },
  onProgress: (cb) => ipcRenderer.on('sefaz:progress', (_, msg) => cb(msg)),
},
nfse: {
  servicos: {
    list: (filtros) => ipcRenderer.invoke('nfse:servicos:list', filtros),
    anosDisponiveis: (id) => ipcRenderer.invoke('nfse:servicos:anosDisponiveis', id),
    buscarXml: (id) => ipcRenderer.invoke('nfse:servicos:buscarXml', id),
    togglePagamento: (id) => ipcRenderer.invoke('nfse:servicos:togglePagamento', id),
    marcarEmailEnviado: (id) => ipcRenderer.invoke('nfse:servicos:marcarEmailEnviado', id),
  },
  consultar: (id) => ipcRenderer.invoke('nfse:consultar', id),
  reimportar: (id) => ipcRenderer.invoke('nfse:reimportar', id),
  verificarEventos: (id) => ipcRenderer.invoke('nfse:verificarEventos', id),
  exportarNF: (payload) => ipcRenderer.invoke('nfse:exportarNF', payload),
  onProgress: (cb) => ipcRenderer.on('nfse:progress', (_, msg) => cb(msg)),
},
tributos: {
  getPremissas: (id) => ipcRenderer.invoke('tributos:getPremissas', id),
  savePremissas: (id, data) => ipcRenderer.invoke('tributos:savePremissas', id, data),
  getFaturamento: (id, ano, trim) => ipcRenderer.invoke('tributos:getFaturamento', id, ano, trim),
  salvarTrimestre: (data) => ipcRenderer.invoke('tributos:salvarTrimestre', data),
  getHistorico: (id) => ipcRenderer.invoke('tributos:getHistorico', id),
  getHistoricoTrimestre: (id, ano, trim) => ipcRenderer.invoke('tributos:getHistoricoTrimestre', id, ano, trim),
  deleteHistorico: (id) => ipcRenderer.invoke('tributos:deleteHistorico', id),
},
```

---

### Passo 5 — Componentes React (`src/pages/sefaz/`)

Criar os seguintes arquivos (ver código-fonte neste repositório como referência):

| Arquivo | Responsabilidade |
|---------|-----------------|
| `SefazPage.tsx` | Shell com sub-abas (`nfes`, `nfse`, `tributos`, `empresas`, `destinatarios`) |
| `SefazNFesPage.tsx` | Lista NF-es recebidas SEFAZ com filtros, ações e modais |
| `NfseServicosPage.tsx` | Lista NFS-e com badges emitida/recebida, filtros e modais |
| `TributosPage.tsx` | Calculadora trimestral + histórico + modal de premissas |
| `SefazEmpresasPage.tsx` | CRUD de empresas SEFAZ com upload de certificado |
| `SefazDestinatariosPage.tsx` | CRUD simples de destinatários |

**Padrões importantes:**
- `INSERT OR IGNORE` no backend → sem duplicatas por `chave_acesso`
- Filtros passados como objeto ao IPC; construção de SQL dinâmica com `params` nomeados
- `onProgress` registrado via `ipcRenderer.on` no `useEffect`, removido no cleanup
- Selects com busca (`SearchableSelect`) nos modais de exportação
- Modal de exportação para Controle de NF: lê CNPJ do XML, busca empresa correspondente, cria fornecedor automaticamente se não existir

---

### Passo 6 — Integrações externas

#### SEFAZ NF-e (`electron/sefaz/consulta.ts`)
- Protocolo SOAP/HTTPS com certificado mTLS
- Endpoint: webservice de Distribuição de Documentos Fiscais da SEFAZ nacional
- Resposta XML parsada com `xml2js` ou regex
- Implementar rate limiting: máximo 19 requisições/dia; cooldown de 65 min ao ser bloqueado

#### ADN Nacional NFS-e (`electron/nfse/consulta.ts`)
- API REST com autenticação por certificado A1
- Paginação por NSU: iterar até não receber mais documentos
- Retorna emitidas e recebidas misturadas — classificar pelo CNPJ do prestador
- Implementar `verificarEventos` separado para checar cancelamentos

---

## Integração Futura com nfe-monitor

| Dado do nfe-monitor | Mapeamento no Controle NF_Caixa |
|---------------------|---------------------------------|
| `nfes_recebidas.fornecedor_cnpj` → | `fornecedores.cnpj` |
| `nfes_recebidas.fornecedor_nome` → | `fornecedores.nome` |
| `nfes_recebidas.valor_nota` → | `notas_fiscais.valor_total` |
| `nfes_recebidas.nf_data` → | `notas_fiscais.data_emissao` |
| `nfes_recebidas.chave_acesso` → | Novo campo `notas_fiscais.nfe_chave_acesso` |
| `nfes_recebidas.xml_blob` → | Novo campo `nf_anexos` com o XML |

**Estratégia sugerida:**
1. Adicionar coluna `nfe_chave_acesso TEXT` em `notas_fiscais` (migration)
2. Botão "Importar NF-e monitorada" no NFForm
3. Comunicação entre apps via arquivo JSON em pasta compartilhada ou SQLite read-only cross-process
4. Ao importar: pré-preencher fornecedor (buscar por CNPJ), valor, data, anexar XML como arquivo
