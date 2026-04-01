import { getDb } from '../db'

// ---- EMPRESAS ----
export const empresasQueries = {
  list: () => getDb().prepare('SELECT * FROM empresas ORDER BY nome').all(),
  get: (id: number) => getDb().prepare('SELECT * FROM empresas WHERE id = ?').get(id),
  create: (data: { nome: string; cnpj?: string }) =>
    getDb().prepare('INSERT INTO empresas (nome, cnpj) VALUES (@nome, @cnpj)').run(data),
  update: (id: number, data: { nome: string; cnpj?: string }) =>
    getDb().prepare('UPDATE empresas SET nome=@nome, cnpj=@cnpj WHERE id=@id').run({ ...data, id }),
  delete: (id: number) => getDb().prepare('DELETE FROM empresas WHERE id = ?').run(id)
}

// ---- UNIDADES ----
export const unidadesQueries = {
  list: () =>
    getDb()
      .prepare(
        `SELECT u.*, e.nome as empresa_nome FROM unidades u
         LEFT JOIN empresas e ON e.id = u.empresa_id ORDER BY u.nome`
      )
      .all(),
  listByEmpresa: (empresa_id: number) =>
    getDb().prepare('SELECT * FROM unidades WHERE empresa_id = ? ORDER BY nome').all(empresa_id),
  get: (id: number) => getDb().prepare('SELECT * FROM unidades WHERE id = ?').get(id),
  create: (data: { nome: string; empresa_id?: number }) =>
    getDb().prepare('INSERT INTO unidades (nome, empresa_id) VALUES (@nome, @empresa_id)').run(data),
  update: (id: number, data: { nome: string; empresa_id?: number }) =>
    getDb()
      .prepare('UPDATE unidades SET nome=@nome, empresa_id=@empresa_id WHERE id=@id')
      .run({ ...data, id }),
  delete: (id: number) => getDb().prepare('DELETE FROM unidades WHERE id = ?').run(id)
}

// ---- CENTROS DE CUSTO ----
export const centrosCustoQueries = {
  list: () => getDb().prepare('SELECT * FROM centros_custo ORDER BY codigo').all(),
  get: (id: number) => getDb().prepare('SELECT * FROM centros_custo WHERE id = ?').get(id),
  create: (data: { codigo: string; descricao: string }) =>
    getDb()
      .prepare('INSERT INTO centros_custo (codigo, descricao) VALUES (@codigo, @descricao)')
      .run(data),
  update: (id: number, data: { codigo: string; descricao: string }) =>
    getDb()
      .prepare('UPDATE centros_custo SET codigo=@codigo, descricao=@descricao WHERE id=@id')
      .run({ ...data, id }),
  delete: (id: number) => getDb().prepare('DELETE FROM centros_custo WHERE id = ?').run(id)
}

// ---- FORNECEDORES ----
export const fornecedoresQueries = {
  list: () => getDb().prepare('SELECT * FROM fornecedores ORDER BY nome').all(),
  get: (id: number) => getDb().prepare('SELECT * FROM fornecedores WHERE id = ?').get(id),
  create: (data: Record<string, unknown>) =>
    getDb()
      .prepare(
        `INSERT INTO fornecedores (nome, cnpj, banco, agencia, conta, pix, telefone_fixo, celular, email, contato)
         VALUES (@nome, @cnpj, @banco, @agencia, @conta, @pix, @telefone_fixo, @celular, @email, @contato)`
      )
      .run(data),
  update: (id: number, data: Record<string, unknown>) =>
    getDb()
      .prepare(
        `UPDATE fornecedores SET nome=@nome, cnpj=@cnpj, banco=@banco,
         agencia=@agencia, conta=@conta, pix=@pix,
         telefone_fixo=@telefone_fixo, celular=@celular, email=@email, contato=@contato
         WHERE id=@id`
      )
      .run({ ...data, id }),
  delete: (id: number) => getDb().prepare('DELETE FROM fornecedores WHERE id = ?').run(id),
  findByCnpj: (cnpj: string) =>
    getDb()
      .prepare(`SELECT * FROM fornecedores WHERE replace(replace(replace(cnpj,'.',''),'/',''),'-','') = ?`)
      .get(cnpj.replace(/\D/g, '')) as Record<string, unknown> | undefined,
}

// ---- FUNCIONARIOS ----
export const funcionariosQueries = {
  list: () =>
    getDb()
      .prepare(
        `SELECT f.*, e.nome as empresa_nome FROM funcionarios f
         LEFT JOIN empresas e ON e.id = f.empresa_id WHERE f.ativo = 1 ORDER BY f.nome`
      )
      .all(),
  get: (id: number) => getDb().prepare('SELECT * FROM funcionarios WHERE id = ?').get(id),
  create: (data: { nome: string; cargo?: string; empresa_id?: number }) =>
    getDb()
      .prepare('INSERT INTO funcionarios (nome, cargo, empresa_id) VALUES (@nome, @cargo, @empresa_id)')
      .run(data),
  update: (id: number, data: { nome: string; cargo?: string; empresa_id?: number }) =>
    getDb()
      .prepare('UPDATE funcionarios SET nome=@nome, cargo=@cargo, empresa_id=@empresa_id WHERE id=@id')
      .run({ ...data, id }),
  delete: (id: number) =>
    getDb().prepare('UPDATE funcionarios SET ativo = 0 WHERE id = ?').run(id),
  validateEmailPassword: (senha: string): boolean => {
    const row = getDb()
      .prepare('SELECT value FROM settings WHERE key = ? LIMIT 1')
      .get('email_senha_assinatura') as { value: string } | undefined
    if (!row?.value) return false
    return row.value === senha
  },
}
