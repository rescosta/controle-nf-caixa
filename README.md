# Controle NF + Caixa

Aplicativo desktop para gestão de Notas Fiscais, Acerto de Caixa e monitoramento de documentos fiscais eletrônicos via SEFAZ.

Desenvolvido com Electron + React + TypeScript, banco de dados local SQLite — sem necessidade de internet para o uso principal, sem servidores externos.

---

## Novidades — v1.1.0

### Monitor NFS-e (Notas de Serviço)

- **Coluna Tipo Emitida/Recebida** — a API ADN Nacional retorna todas as NFS-e vinculadas ao CNPJ consultado, incluindo notas emitidas pela própria empresa. Agora cada nota exibe badge colorido (violeta = Emitida, azul = Recebida). O tipo é determinado automaticamente comparando o CNPJ do prestador com o CNPJ da empresa cadastrada. O filtro "Tipo" permite isolar cada grupo.
- **Notas emitidas não exportáveis** — NFS-e emitidas não exibem o botão de exportação para Controle de NF (só fazem sentido exportar as recebidas/tomadas).
- **Faturamento sem duplicatas** — o sistema agora usa exclusivamente a fonte ADN Nacional para cálculos, evitando duplicação com registros legados BHISS que representam as mesmas notas com numerações diferentes.

### Aba Impostos — Calculadora Trimestral (Lucro Presumido)

Nova aba entre NFS-e Tomadas e Empresas SEFAZ com calculadora completa de tributos para empresas de serviço no regime de Lucro Presumido.

- **Faturamento automático** — valores preenchidos diretamente das NFS-e emitidas (fonte ADN) do período selecionado, por mês do trimestre
- **Edição manual** — faturamento editável para ajustes antes de salvar
- **Cálculo em tempo real** de IRPJ, CSLL, PIS e COFINS com todas as deduções:
  - IRPJ: base × presunção × 15% + adicional 10% sobre base > R$60.000 − IRRF retido
  - CSLL: base × 9% − CSLL retida na fonte
  - PIS/COFINS: exibidos como apurados, com suporte a retenção 100% pelo tomador (DARF = R$0,00)
- **PIS/COFINS retidos na fonte** — quando ativado nas premissas (padrão para empresas de serviço), PIS e COFINS apurados são exibidos para referência mas não entram no "Total a Recolher (DARF)", refletindo a realidade de empresas cujos clientes retêm 100% na fonte
- **Premissas por empresa** — alíquotas totalmente configuráveis (presunção, IRPJ, CSLL, PIS, COFINS, IRRF, CSLL retida) com modal dedicado
- **Histórico trimestral** — trimestres salvos persistem no banco de dados; ao retornar ao mesmo período, os valores salvos são carregados automaticamente (com aviso e botão para restaurar valores das NFS-e)
- **Carga tributária efetiva** — percentual sobre o faturamento exibido em tempo real, incluindo PIS+COFINS mesmo quando retidos

### Monitor NF-e (SEFAZ)

- **Exportar NF-e para Controle de NF** — botão em cada linha abre modal para selecionar empresa/unidade/centro de custo e importa os dados automaticamente. CNPJ do emitente é lido do XML e pré-preenche a empresa. Fornecedor criado automaticamente se não existir.

### Controle de NF

- **Status Pendente** — NFs importadas do SEFAZ ficam com status "Pendente" (cinza) até serem editadas pela primeira vez, quando passam automaticamente para "A Pagar".

### Interface

- **Manual do Usuário** — aba "Manual" na navegação principal com guia completo de todas as funcionalidades do sistema, organizado por módulo.
- **Selects buscáveis** — campos de empresa, unidade e centro de custo nos modais de exportação possuem filtro de texto.

---

## Funcionalidades

### Controle de NF
Gestão completa do ciclo de vida de notas fiscais a pagar.

- Cadastro de NFs com número sequencial automático
- Campos: empresa, unidade, centro de custo, fornecedor, número da NF, data, descrição, valor da nota, valor do boleto, vencimento, forma de pagamento (boleto, PIX, transferência), dados bancários
- Status: **Pendente** → **A Pagar** → **Pago** / **Atrasado** (calculado automaticamente por vencimento)
- Marcar como pago com data de pagamento
- Desfazer pagamento
- Duplicar NF (gera nova com status A Pagar, mantendo dados originais)
- Exclusão com confirmação
- **Parcelas**: divisão da NF em múltiplas parcelas com valores e vencimentos individuais
- **Programação de Pagamentos**: controle financeiro futuro separado das parcelas
- **Envio por e-mail**: envia os dados da NF por e-mail via SMTP configurado
- **Filtros**: por empresa, unidade, centro de custo, fornecedor, status, período de vencimento
- Dashboard com totais: valor total a pagar, vencendo hoje, vencidos

### Acerto de Caixa
Controle diário de caixa por funcionário.

- Registro de acertos por data e funcionário
- Lançamento de entradas e saídas
- Controle de refeições mensais (almoço/jantar por dia)
- Histórico de acertos

### Monitor NF-e (SEFAZ)
Monitoramento e importação de documentos fiscais eletrônicos.

#### NF-es Recebidas
- Consulta automatizada de NF-es recebidas via webservice SEFAZ (Distribuição de Documentos Fiscais)
- Download e armazenamento local do XML completo
- Visualização de chave de acesso, emitente, valor, data de emissão
- Download individual do XML
- Envio do XML por e-mail
- **Exportar para Controle de NF**: abre modal para selecionar empresa/unidade/centro de custo e importa os dados diretamente para o Controle de NF. CNPJ do destinatário é lido do XML para pré-preencher a empresa automaticamente

#### NFS-e Tomadas (Notas de Serviço)
- Consulta de NFS-e via API ADN Nacional por CNPJ da empresa
- **Coluna Tipo**: badge indica se a NFS-e foi **Emitida** (empresa é o prestador — violeta) ou **Recebida** (empresa é o tomador — azul) — determinado automaticamente pelo CNPJ do prestador; filtro dedicado no topo
- Dados: prestador, competência, valor dos serviços, descrição
- Paginação automática (busca todos os NSUs disponíveis)
- Envio por e-mail
- **Exportar para Controle de NF**: apenas NFS-e recebidas — CNPJ do prestador pré-preenchido como fornecedor
- **Reimportar**: reprocessa todas as NFS-e do zero, recalculando tipos e atualizando registros

#### Impostos — Calculadora Trimestral (Lucro Presumido)
- Calculadora de tributos trimestrais baseada nas NFS-e **emitidas** da empresa (fonte ADN, sem duplicatas BHISS)
- Faturamento preenchido automaticamente por mês do trimestre; ajuste manual permitido com botão de restauração
- Cálculo em tempo real de IRPJ, CSLL, PIS e COFINS:
  - Base = faturamento × % de presunção (padrão 32% para serviços)
  - IRPJ = base × 15% + adicional IR (10% sobre base > R$60.000) − IRRF retido
  - CSLL = base × 9% − CSLL retida na fonte
  - PIS/COFINS: apurados mas com **retenção 100% pelo tomador** (DARF = R$0,00 — comportamento padrão para empresas de serviço)
- Premissas (alíquotas, presunção, regime de retenção) configuráveis individualmente por empresa
- Histórico de trimestres salvos; valores carregados automaticamente ao revisitar o período
- Total a Recolher (DARF) = IRPJ + CSLL; carga efetiva % inclui PIS+COFINS como custo real

#### Empresas SEFAZ
- Cadastro de certificados digitais A1 (arquivo .pfx + senha)
- Configuração de CNPJ, ambiente (produção/homologação) e último NSU consultado
- Suporte a múltiplas empresas

#### Destinatários
- Lista de destinatários para envio de e-mails das NFs

### Relatórios de Custo
- Gráficos de custos por período, empresa, unidade e centro de custo
- Exportação de dados para análise

### Configurações

| Seção | Descrição |
|---|---|
| Empresas | Razão social, CNPJ, endereço |
| Unidades | Vinculadas à empresa |
| Centros de Custo | Código + descrição |
| Fornecedores | Nome, CNPJ, contatos |
| Funcionários | Cadastro para uso no Acerto de Caixa |
| E-mail / SMTP | Host, porta, usuário, senha, TLS — teste de envio integrado |
| Backup | Exportar e importar banco de dados SQLite |
| Sequência inicial de NF | Define número de partida do sequencial |

---

## Stack Técnica

| Camada | Tecnologia |
|---|---|
| Desktop | Electron 31 |
| Interface | React 18 + TypeScript |
| Estilos | Tailwind CSS 3 (dark/light mode) |
| Build frontend | Vite + electron-vite |
| Banco de dados | SQLite via better-sqlite3 (local, sem servidor) |
| E-mail | Nodemailer |
| Empacotamento | electron-builder |

---

## Pré-requisitos de Desenvolvimento

- Node.js 20+
- Python 3.x (necessário para compilar `better-sqlite3`)
- macOS com Xcode Command Line Tools **ou** Windows com Visual Studio Build Tools

---

## Instalação e Execução

```bash
# Instalar dependências (também compila o módulo nativo better-sqlite3)
npm install

# Rodar em modo desenvolvimento (hot reload)
npm run dev
```

---

## Build e Distribuição

### macOS (ARM64 + Intel — gerar localmente)

```bash
npm run dist:mac
```

Gera dois arquivos na pasta `dist/`:
- `Controle NF + Caixa-x.x.x-arm64.dmg` (Apple Silicon)
- `Controle NF + Caixa-x.x.x-x64.dmg` (Intel)

> **Importante:** para macOS, o build deve ser feito na própria máquina Mac para aproveitar o certificado de desenvolvedor local. Builds não assinados são bloqueados pelo Gatekeeper.

### Windows (via GitHub Actions ou local)

```bash
# Local (requer Windows ou cross-compile)
npm run dist

# CI: o GitHub Actions gera o .exe automaticamente a cada push
```

O instalador NSIS é gerado em `dist/` com nome `Controle NF + Caixa Setup x.x.x.exe`.

---

## Configuração Inicial

Após a primeira execução:

1. **Configurações → Empresas**: cadastre ao menos uma empresa
2. **Configurações → E-mail/SMTP**: configure servidor para envio de e-mails (ex: Gmail, Outlook, servidor próprio)
3. **Monitor NF-e → Empresas SEFAZ**: importe o certificado A1 `.pfx` de cada empresa para consultar documentos fiscais

---

## Dados e Privacidade

- Todos os dados são armazenados **localmente** no SQLite (sem nuvem, sem servidor)
- Certificados digitais ficam armazenados apenas no banco local
- Backup manual disponível em **Configurações → Backup**

O banco de dados fica em:
- **macOS**: `~/Library/Application Support/controle-nf-caixa/database.db`
- **Windows**: `%APPDATA%\controle-nf-caixa\database.db`

---

## Estrutura do Projeto

```
├── electron/               # Processo principal (Node/Electron)
│   ├── main.ts             # Handlers IPC + inicialização
│   ├── preload.ts          # Bridge IPC → renderer
│   ├── database/           # SQLite: migrations, queries
│   ├── nfse/               # Integração ADN NFS-e
│   └── bhiss/              # Integração SEFAZ NF-e
├── src/                    # Renderer (React)
│   ├── pages/
│   │   ├── nf/             # Controle de NF
│   │   ├── caixa/          # Acerto de Caixa
│   │   ├── sefaz/          # Monitor SEFAZ
│   │   ├── relatorios/     # Relatórios
│   │   ├── config/         # Configurações
│   │   └── manual/         # Manual do usuário
│   └── components/         # Componentes reutilizáveis
└── electron-builder.yml    # Configuração de empacotamento
```

---

## Licença

Uso interno. Todos os direitos reservados.
