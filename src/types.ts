export interface Empresa {
  id: number
  nome: string
  cnpj?: string
}

export interface Unidade {
  id: number
  nome: string
  empresa_id?: number
  empresa_nome?: string
}

export interface CentroCusto {
  id: number
  codigo: string
  descricao: string
}

export interface Fornecedor {
  id: number
  nome: string
  cnpj?: string
  banco?: string
  agencia?: string
  conta?: string
  pix?: string
  telefone_fixo?: string
  celular?: string
  email?: string
  contato?: string
}

export interface Funcionario {
  id: number
  nome: string
  cargo?: string
  empresa_id?: number
  empresa_nome?: string
  ativo: number
}

export interface NotaFiscal {
  id: number
  numero_seq: number
  empresa_id?: number
  unidade_id?: number
  centro_custo_id?: number
  nf_numero?: string
  nf_data?: string
  fornecedor_id?: number
  descricao?: string
  valor_nota: number
  valor_boleto: number
  vencimento?: string
  status: 'a_pagar' | 'pago'
  email_enviado?: number
  data_pagamento?: string
  data_lancamento?: string
  forma_pagamento?: 'boleto' | 'pix' | 'transferencia'
  pix_chave?: string
  banco_pagamento?: string
  agencia_pagamento?: string
  conta_pagamento?: string
  empresa_nome?: string
  unidade_nome?: string
  cc_codigo?: string
  cc_descricao?: string
  fornecedor_nome?: string
}

export interface NFProgramacao {
  id?: number
  nf_id?: number
  valor: number
  vencimento?: string
  observacao?: string
}

export interface NFAnexo {
  id: number
  nf_id: number
  nome: string
  caminho: string
  tipo: 'pdf' | 'imagem'
}

export interface NFParcela {
  id?: number
  nf_id?: number
  numero_parcela: number
  valor: number
  vencimento?: string
  status: 'a_pagar' | 'pago'
  data_pagamento?: string
}

export interface Caixa {
  id: number
  numero_caixa: number
  unidade_id?: number
  empresa_id?: number
  data_envio?: string
  periodo_inicio?: string
  periodo_fim?: string
  executado_por?: string
  responsavel?: string
  saldo_anterior: number
  saldo_final?: number
  status: 'aberto' | 'fechado'
  unidade_nome?: string
  empresa_nome?: string
}

export interface CaixaLancamento {
  id: number
  caixa_id: number
  numero_item: number
  data?: string
  historico?: string
  favorecido?: string
  valor_debito: number
  valor_credito: number
  saldo: number
  tipo: string
}

export interface RelatorioCusto {
  id: number
  nome: string
  filtros: string  // JSON
  created_at?: string
}

export interface Refeicao {
  id?: number
  funcionario_id: number
  mes: number
  ano: number
  tipo: 'almoco' | 'jantar'
  valor_unitario: number
  funcionario_nome?: string
  cargo?: string
  [key: string]: unknown
}
