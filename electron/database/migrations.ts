import type Database from 'better-sqlite3'

export function runMigrations(db: Database.Database): void {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS empresas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cnpj TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS unidades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      empresa_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (empresa_id) REFERENCES empresas(id)
    );

    CREATE TABLE IF NOT EXISTS centros_custo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS fornecedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cnpj TEXT,
      banco TEXT,
      agencia TEXT,
      conta TEXT,
      pix TEXT,
      telefone_fixo TEXT,
      celular TEXT,
      email TEXT,
      contato TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS funcionarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cargo TEXT,
      empresa_id INTEGER,
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (empresa_id) REFERENCES empresas(id)
    );

    CREATE TABLE IF NOT EXISTS notas_fiscais (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_seq INTEGER,
      empresa_id INTEGER,
      unidade_id INTEGER,
      centro_custo_id INTEGER,
      nf_numero TEXT,
      nf_data TEXT,
      fornecedor_id INTEGER,
      descricao TEXT,
      valor_nota REAL DEFAULT 0,
      valor_boleto REAL DEFAULT 0,
      vencimento TEXT,
      status TEXT DEFAULT 'a_pagar',
      data_pagamento TEXT,
      data_lancamento TEXT DEFAULT (date('now','localtime')),
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (empresa_id) REFERENCES empresas(id),
      FOREIGN KEY (unidade_id) REFERENCES unidades(id),
      FOREIGN KEY (centro_custo_id) REFERENCES centros_custo(id),
      FOREIGN KEY (fornecedor_id) REFERENCES fornecedores(id)
    );

    CREATE TABLE IF NOT EXISTS nf_parcelas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nf_id INTEGER NOT NULL,
      numero_parcela INTEGER,
      valor REAL DEFAULT 0,
      vencimento TEXT,
      status TEXT DEFAULT 'a_pagar',
      data_pagamento TEXT,
      FOREIGN KEY (nf_id) REFERENCES notas_fiscais(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS caixas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_caixa INTEGER,
      unidade_id INTEGER,
      empresa_id INTEGER,
      data_envio TEXT,
      periodo_inicio TEXT,
      periodo_fim TEXT,
      executado_por TEXT,
      responsavel TEXT,
      saldo_anterior REAL DEFAULT 0,
      status TEXT DEFAULT 'aberto',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (unidade_id) REFERENCES unidades(id),
      FOREIGN KEY (empresa_id) REFERENCES empresas(id)
    );

    CREATE TABLE IF NOT EXISTS caixa_lancamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caixa_id INTEGER NOT NULL,
      numero_item INTEGER,
      data TEXT,
      historico TEXT,
      favorecido TEXT,
      valor_debito REAL DEFAULT 0,
      valor_credito REAL DEFAULT 0,
      saldo REAL DEFAULT 0,
      tipo TEXT DEFAULT 'normal',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (caixa_id) REFERENCES caixas(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS refeicoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      funcionario_id INTEGER NOT NULL,
      mes INTEGER NOT NULL,
      ano INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      dia_01 TEXT, dia_02 TEXT, dia_03 TEXT, dia_04 TEXT, dia_05 TEXT,
      dia_06 TEXT, dia_07 TEXT, dia_08 TEXT, dia_09 TEXT, dia_10 TEXT,
      dia_11 TEXT, dia_12 TEXT, dia_13 TEXT, dia_14 TEXT, dia_15 TEXT,
      dia_16 TEXT, dia_17 TEXT, dia_18 TEXT, dia_19 TEXT, dia_20 TEXT,
      dia_21 TEXT, dia_22 TEXT, dia_23 TEXT, dia_24 TEXT, dia_25 TEXT,
      dia_26 TEXT, dia_27 TEXT, dia_28 TEXT, dia_29 TEXT, dia_30 TEXT,
      dia_31 TEXT,
      valor_unitario REAL DEFAULT 0,
      FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id),
      UNIQUE(funcionario_id, mes, ano, tipo)
    );
  `)

  // Migração: tabela de programação de pagamentos
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS nf_programacao (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nf_id INTEGER NOT NULL,
        valor REAL DEFAULT 0,
        vencimento TEXT,
        observacao TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (nf_id) REFERENCES notas_fiscais(id) ON DELETE CASCADE
      )
    `)
  } catch { /* já existe */ }

  // Migração: tabela de configurações
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      INSERT OR IGNORE INTO settings (key, value) VALUES ('seq_inicial', '1');
    `)
  } catch { /* já existe */ }

  // Migração: tabela de relatórios de custo
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS relatorios_custo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      filtros TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )`)
  } catch { /* já existe */ }

  // Migração: campo senha_email em funcionarios
  try { db.exec('ALTER TABLE funcionarios ADD COLUMN senha_email TEXT') } catch { /* já existe */ }

  // Migração: flag de e-mail enviado em notas_fiscais
  try { db.exec('ALTER TABLE notas_fiscais ADD COLUMN email_enviado INTEGER DEFAULT 0') } catch { /* já existe */ }

  // Migração: tabela de anexos da NF
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS nf_anexos (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        nf_id   INTEGER NOT NULL,
        nome    TEXT NOT NULL,
        caminho TEXT NOT NULL,
        tipo    TEXT NOT NULL DEFAULT 'pdf',
        created_at TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (nf_id) REFERENCES notas_fiscais(id) ON DELETE CASCADE
      )
    `)
  } catch { /* já existe */ }

  // Migração: adicionar campos de contato em fornecedores
  for (const col of [
    'ALTER TABLE fornecedores ADD COLUMN telefone_fixo TEXT',
    'ALTER TABLE fornecedores ADD COLUMN celular TEXT',
    'ALTER TABLE fornecedores ADD COLUMN email TEXT',
    'ALTER TABLE fornecedores ADD COLUMN contato TEXT',
  ]) {
    try { db.exec(col) } catch { /* coluna já existe */ }
  }

  // Migração: adicionar colunas de forma de pagamento (ignora se já existir)
  for (const col of [
    "ALTER TABLE notas_fiscais ADD COLUMN forma_pagamento TEXT DEFAULT 'boleto'",
    'ALTER TABLE notas_fiscais ADD COLUMN pix_chave TEXT',
    'ALTER TABLE notas_fiscais ADD COLUMN banco_pagamento TEXT',
    'ALTER TABLE notas_fiscais ADD COLUMN agencia_pagamento TEXT',
    'ALTER TABLE notas_fiscais ADD COLUMN conta_pagamento TEXT',
  ]) {
    try { db.exec(col) } catch { /* coluna já existe */ }
  }

  // Migração: adicionar caixa_id à tabela refeicoes (isolar por caixa)
  try {
    const cols = db.prepare("PRAGMA table_info(refeicoes)").all() as { name: string }[]
    if (!cols.find(c => c.name === 'caixa_id')) {
      const dias = Array.from({ length: 31 }, (_, i) => `dia_${String(i + 1).padStart(2, '0')}`)
      const diasCols = dias.map(d => `${d} TEXT`).join(', ')
      const diasList = dias.join(', ')
      db.exec(`
        ALTER TABLE refeicoes RENAME TO refeicoes_old;
        CREATE TABLE refeicoes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          caixa_id INTEGER,
          funcionario_id INTEGER NOT NULL,
          mes INTEGER NOT NULL,
          ano INTEGER NOT NULL,
          tipo TEXT NOT NULL,
          ${diasCols},
          valor_unitario REAL DEFAULT 0,
          FOREIGN KEY (caixa_id) REFERENCES caixas(id) ON DELETE CASCADE,
          FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id),
          UNIQUE(caixa_id, funcionario_id, mes, ano, tipo)
        );
        INSERT INTO refeicoes (caixa_id, funcionario_id, mes, ano, tipo, ${diasList}, valor_unitario)
          SELECT NULL, funcionario_id, mes, ano, tipo, ${diasList}, valor_unitario FROM refeicoes_old;
        DROP TABLE refeicoes_old;
      `)
    }
  } catch { /* já migrado */ }

  // Migração: seed de centros de custo base (executa se código '1' não existir)
  try {
    const ccBase = db.prepare("SELECT COUNT(*) as c FROM centros_custo WHERE codigo = '1'").get() as { c: number }
    if (ccBase.c === 0) {
      db.exec(`
        INSERT INTO centros_custo (codigo, descricao) VALUES
          ('1','DESPESAS'),
          ('1.01','ADMINISTRATIVAS'),
          ('1.01.001','Agua'),
          ('1.01.002','Energia Elétrica'),
          ('1.01.003','Material de Escritorio'),
          ('1.01.004','Material de Limpeza'),
          ('1.01.005','Limpeza/Conservação'),
          ('1.01.006','Alimentação/Lanches'),
          ('1.01.007','Informática'),
          ('1.01.008','Telefonia Fixa'),
          ('1.01.009','Telefonia Móvel'),
          ('1.01.010','Internet'),
          ('1.01.011','Segurança'),
          ('1.01.012','Editais(Concorrências)'),
          ('1.01.013','Garantia de Proposta(Concorrência)'),
          ('1.01.014','Viagens, Estadias, Alimentação'),
          ('1.01.015','Serviços Contábeis'),
          ('1.01.016','Correios'),
          ('1.01.017','Marketing/Propaganda'),
          ('1.01.018','Serviços Advocatícios'),
          ('1.01.019','Caixa'),
          ('1.01.020','Reembolso de Despesas'),
          ('1.01.021','Passagens Aereas'),
          ('1.01.022','Compra Equip e Manutenção Ar Condiconado'),
          ('1.01.023','Locação de Imóveis'),
          ('1.01.024','Despesas com T.I'),
          ('1.01.025','Despesas Diversas Comprovadas'),
          ('1.01.026','Moveis para Escritório'),
          ('1.01.027','Pedágios, Estacionamentos, Taxis'),
          ('1.01.028','Regsitro ART´s / CREA'),
          ('1.01.029','Associações e Sindicatos'),
          ('1.01.030','Seguro de Veiculos'),
          ('1.01.031','Manutenção de Software'),
          ('1.01.032','Manutenção do escritório'),
          ('1.01.033','Locação/Manutenção Copiadora'),
          ('1.01.034','Certificado Digital'),
          ('1.02','PESSOAL'),
          ('1.02.001','Prêmios / Gratificações/Taxa Corretagem'),
          ('1.02.002','Salário'),
          ('1.02.003','13 Salário'),
          ('1.02.004','Férias'),
          ('1.02.005','Vale Transporte/Transporte'),
          ('1.02.006','Vale Refeição'),
          ('1.02.007','Premios'),
          ('1.02.008','Seguro'),
          ('1.02.009','Rescisões / Indenizações Trabalhistas'),
          ('1.02.010','E.P.I / Uniformes'),
          ('1.02.011','Hospedagem'),
          ('1.02.012','Acordo Trabalhista'),
          ('1.02.013','Viagem/Casa'),
          ('1.02.014','Recurso Trabalhista'),
          ('1.02.015','Pensão Alimentícia Judicial'),
          ('1.02.016','Empréstimo para funcionário'),
          ('1.02.017','Seguro de Vida / Acidentes Pessoais'),
          ('1.02.018','Cesta Básica'),
          ('1.02.019','GRFC - Guia de Recolhimento Recisória FGTS'),
          ('1.02.020','PPRA'),
          ('1.02.021','PCMSO'),
          ('1.02.022','Recrutamento e Seleção'),
          ('1.02.023','IRRF s/ folha'),
          ('1.02.024','INSS s/ folha'),
          ('1.03','OBRAS E SERVIÇOS'),
          ('1.03.001','Subempreiteiros / Serviços Terceirizados'),
          ('1.03.002','Locação Equipamentos'),
          ('1.03.003','Manutenção Obras'),
          ('1.03.004','Locação de Imóveis'),
          ('1.03.005','Insumos'),
          ('1.03.006','Combustiveis / Lubrificantes'),
          ('1.03.007','Locação Veiculos Leves'),
          ('1.03.008','Taxa Administração'),
          ('1.03.009','Fretes e Carretos'),
          ('1.04','PATRIMÔNIO'),
          ('1.04.001','Veiculos Leves'),
          ('1.04.002','Imoveis'),
          ('1.04.003','Equipamentos Leves'),
          ('1.04.004','Maquinas e Equipamentos Escritório'),
          ('1.04.005','Móveis Utensilios'),
          ('1.04.006','FINAME'),
          ('1.04.007','Manutenção de Veiculos'),
          ('1.05','DESPESAS BANCÁRIAS'),
          ('1.05.001','Manutenção de Contas'),
          ('1.05.002','Tarifas/Doc/Ted/Adiant Dep'),
          ('1.05.003','Juros'),
          ('1.05.004','IOF'),
          ('1.05.005','Aplicações Financeiras'),
          ('1.05.006','Amortização de Emprestimos'),
          ('1.05.007','Imposto de Renda sobre Aplicação Financeira'),
          ('1.05.008','Conta Garantida'),
          ('1.05.009','Capitalização'),
          ('1.05.010','Encargos conta garantida'),
          ('1.05.011','consocio'),
          ('1.05.012','Mora Conta Garantida'),
          ('1.05.013','Resgate Capitalização'),
          ('1.05.014','Resgate Aplicação'),
          ('1.06','IMPOSTOS E TAXAS'),
          ('1.06.001','IRPJ - Imposto de Renda Pessoa Juridica'),
          ('1.06.002','PIS'),
          ('1.06.003','COFINS'),
          ('1.06.004','INSS'),
          ('1.06.005','FGTS'),
          ('1.06.006','ISS - Imposto sobre serviço retido de faturamento'),
          ('1.06.007','Paes/Refis'),
          ('1.06.008','IPVA'),
          ('1.06.009','IPTU'),
          ('1.06.010','Seguro Obrigatório/Taxa Licenciamento'),
          ('1.06.011','Taxas de Cartório'),
          ('1.06.012','CSSL - Constribuição Social sobre Lucro Liquido'),
          ('1.06.013','Siticop'),
          ('1.06.014','Sinduscon'),
          ('1.06.015','Crea'),
          ('1.06.016','Sindicato dos Engenheiros'),
          ('1.06.017','Alvaras'),
          ('1.06.018','Seconci-MG'),
          ('1.06.019','Multas de Trânsito'),
          ('1.06.020','Taxas de Incêndio'),
          ('1.06.021','Inscrição Estadual'),
          ('1.06.022','Taxas Judiciais'),
          ('1.06.023','IEF'),
          ('1.06.024','ITBI'),
          ('1.06.025','Multas'),
          ('1.06.026','DPVAT'),
          ('1.06.027','Taxa de Licenciamento'),
          ('1.06.028','ISSQN retido de fornecedores'),
          ('1.06.029','Taxa de condominio'),
          ('1.06.030','Contribuição Sindical'),
          ('1.06.031','IRRF - Imposto de renda retido de fornecedores'),
          ('1.06.032','PIS/COFINS/CSSL retido de fornecedores'),
          ('1.06.033','Taxas de Aprovação de Projetos'),
          ('1.06.034','Certidão Simplificda'),
          ('1.06.035','TFLF-Taxa de Fsicaslização de Localização e Funcio'),
          ('1.07','PARTICIPAÇÕES FINANCEIRAS'),
          ('1.07.001','Aporte'),
          ('1.07.002','Distribuição de Lucros'),
          ('1.07.003','Contrato de Mútuo'),
          ('1.07.004','Devolução de aporte de capital'),
          ('1.08','RELAÇÕES PUBLICAS'),
          ('1.08.001','Brindes'),
          ('1.08.002','Alimentação'),
          ('1.08.003','Passagens Aereas'),
          ('2','RECEITAS'),
          ('2.01','ADMINISTRATIVAS'),
          ('2.01.001','Aportes de Capital'),
          ('2.01.002','AFAC - Adiantamento para Futuro Aumento de capital'),
          ('2.01.003','Distribuição de Lucro'),
          ('2.01.004','Reembolso de Despesas'),
          ('2.01.005','Devolução de Mutuo'),
          ('2.01.006','Recebimento de Mutuo'),
          ('2.01.007','Venda de patrimônio'),
          ('2.02','OBRAS'),
          ('2.02.001','Prestação de Serviço'),
          ('2.02.003','Venda de produtos'),
          ('2.03','RECEITAS BANCÁRIAS'),
          ('2.03.001','Estorno de Tarifas'),
          ('2.03.002','Empréstimos'),
          ('2.03.003','Rendimento Aplicações'),
          ('2.03.004','Conta garantida'),
          ('2.03.005','Emprestimo Conta Garantida');
      `)
    }
  } catch { /* migração CC base já aplicada */ }

  // Migração: recalcular saldos de todos os lançamentos a partir de zero (saldo_anterior é apenas informativo)
  try {
    const caixas = db.prepare('SELECT id FROM caixas').all() as { id: number }[]
    const getLancs = db.prepare('SELECT id, valor_debito, valor_credito FROM caixa_lancamentos WHERE caixa_id=? ORDER BY numero_item')
    const updateSaldo = db.prepare('UPDATE caixa_lancamentos SET saldo=? WHERE id=?')
    for (const caixa of caixas) {
      const lancs = getLancs.all(caixa.id) as { id: number; valor_debito: number; valor_credito: number }[]
      let saldo = 0
      for (const l of lancs) {
        saldo = saldo - Number(l.valor_debito ?? 0) + Number(l.valor_credito ?? 0)
        updateSaldo.run(saldo, l.id)
      }
    }
  } catch { /* recalculo falhou */ }

  // Seeds iniciais se tabelas estiverem vazias
  const count = db.prepare('SELECT COUNT(*) as c FROM empresas').get() as { c: number }
  if (count.c === 0) {
    db.exec(`
      INSERT INTO empresas (nome, cnpj) VALUES ('Empresa Exemplo', '00.000.000/0001-00');
      INSERT INTO unidades (nome, empresa_id) VALUES ('Unidade Central', 1);
    `)
  }

  // ========== NFS-e Monitor — NSU separado por empresa ==========
  try { db.exec('ALTER TABLE sefaz_empresas ADD COLUMN ultimo_nsu_nfse TEXT DEFAULT \'0\'') } catch { /* já existe */ }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS nfse_servicos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        created_at TEXT DEFAULT (datetime('now','localtime'))
      )
    `)
  } catch { /* tabela nfse_servicos já existe */ }

  // Migração: fonte na tabela nfse_servicos (adn | bhiss)
  try { db.exec("ALTER TABLE nfse_servicos ADD COLUMN fonte TEXT DEFAULT 'adn'") } catch { /* já existe */ }
  // Migração: cancelada na tabela nfse_servicos
  try { db.exec("ALTER TABLE nfse_servicos ADD COLUMN cancelada INTEGER DEFAULT 0") } catch { /* já existe */ }
  // Migração: email_enviado na tabela nfse_servicos
  try { db.exec("ALTER TABLE nfse_servicos ADD COLUMN email_enviado INTEGER DEFAULT 0") } catch { /* já existe */ }
  // Migração: tipo na tabela nfse_servicos (emitida | recebida)
  try { db.exec("ALTER TABLE nfse_servicos ADD COLUMN tipo TEXT DEFAULT 'recebida'") } catch { /* já existe */ }
  // Migração: pis_cofins_retidos na tabela tributos_premissas
  try { db.exec('ALTER TABLE tributos_premissas ADD COLUMN pis_cofins_retidos INTEGER DEFAULT 1') } catch { /* já existe */ }
  // Migração: presuncao_csll e tipo_empresa em tributos_premissas (imobiliárias têm IRPJ 8% e CSLL 12%)
  try { db.exec("ALTER TABLE tributos_premissas ADD COLUMN presuncao_csll REAL DEFAULT 0.32") } catch { /* já existe */ }
  try { db.exec("ALTER TABLE tributos_premissas ADD COLUMN tipo_empresa TEXT DEFAULT 'servicos'") } catch { /* já existe */ }
  // Migração: base_csll e outras_receitas em tributos_historico
  try { db.exec('ALTER TABLE tributos_historico ADD COLUMN base_csll REAL DEFAULT 0') } catch { /* já existe */ }
  try { db.exec('ALTER TABLE tributos_historico ADD COLUMN outras_receitas REAL DEFAULT 0') } catch { /* já existe */ }
  // Backfill: sincronizar base_csll com base_irpj nos registros existentes que não tinham campo separado
  try { db.exec('UPDATE tributos_historico SET base_csll = base_irpj WHERE base_csll = 0 AND base_irpj > 0') } catch { /* falhou */ }
  // Backfill tipo: marca como 'emitida' os registros onde prestador_cnpj == cnpj da empresa consultada
  try {
    db.exec(`
      UPDATE nfse_servicos SET tipo = 'emitida'
      WHERE replace(replace(replace(prestador_cnpj,'.',''),'/',''),'-','') = (
        SELECT replace(replace(replace(cnpj,'.',''),'/',''),'-','')
        FROM sefaz_empresas
        WHERE sefaz_empresas.id = nfse_servicos.empresa_id
      )
    `)
  } catch { /* backfill falhou */ }

  // ========== Tributos (Lucro Presumido) ==========
  try {
    db.exec(`
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
    `)
  } catch { /* tabelas tributos já existem */ }

  // ========== SEFAZ Monitor — tabelas isoladas (prefixo sefaz_) ==========
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sefaz_empresas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        cnpj TEXT NOT NULL UNIQUE,
        uf TEXT DEFAULT '35',
        pfx_b64 TEXT,
        pfx_senha TEXT,
        ambiente TEXT DEFAULT 'producao',
        ultimo_nsu TEXT DEFAULT '000000000000000',
        sefaz_consultas_count INTEGER DEFAULT 0,
        sefaz_consultas_data TEXT DEFAULT '',
        sefaz_cooldown_ate TEXT DEFAULT '',
        ativo INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS sefaz_nfes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empresa_id INTEGER NOT NULL REFERENCES sefaz_empresas(id),
        chave_acesso TEXT UNIQUE NOT NULL,
        nsu TEXT NOT NULL,
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
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS sefaz_destinatarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        ativo INTEGER DEFAULT 1
      );
    `)
  } catch { /* tabelas SEFAZ já existem */ }
}
