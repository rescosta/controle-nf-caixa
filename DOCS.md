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
