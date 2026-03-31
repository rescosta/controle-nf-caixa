import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Window
  win: {
    platform: () => ipcRenderer.invoke('win:platform'),
    minimize: () => ipcRenderer.invoke('win:minimize'),
    maximize: () => ipcRenderer.invoke('win:maximize'),
    close: () => ipcRenderer.invoke('win:close'),
    isMaximized: () => ipcRenderer.invoke('win:isMaximized'),
  },

  // Cadastros
  empresas: {
    list: () => ipcRenderer.invoke('empresas:list'),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('empresas:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('empresas:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('empresas:delete', id),
  },
  unidades: {
    list: () => ipcRenderer.invoke('unidades:list'),
    listByEmpresa: (empresa_id: number) => ipcRenderer.invoke('unidades:listByEmpresa', empresa_id),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('unidades:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('unidades:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('unidades:delete', id),
  },
  centrosCusto: {
    list: () => ipcRenderer.invoke('centrosCusto:list'),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('centrosCusto:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('centrosCusto:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('centrosCusto:delete', id),
  },
  fornecedores: {
    list: () => ipcRenderer.invoke('fornecedores:list'),
    get: (id: number) => ipcRenderer.invoke('fornecedores:get', id),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('fornecedores:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('fornecedores:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('fornecedores:delete', id),
  },
  funcionarios: {
    list: () => ipcRenderer.invoke('funcionarios:list'),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('funcionarios:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('funcionarios:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('funcionarios:delete', id),
  },

  // NF
  nf: {
    list: (filters?: Record<string, unknown>) => ipcRenderer.invoke('nf:list', filters),
    get: (id: number) => ipcRenderer.invoke('nf:get', id),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('nf:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('nf:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('nf:delete', id),
    marcarPago: (id: number, data_pagamento: string) => ipcRenderer.invoke('nf:marcarPago', id, data_pagamento),
    desfazerPagamento: (id: number) => ipcRenderer.invoke('nf:desfazerPagamento', id),
    getParcelas: (nf_id: number) => ipcRenderer.invoke('nf:getParcelas', nf_id),
    saveParcelas: (nf_id: number, parcelas: unknown[]) => ipcRenderer.invoke('nf:saveParcelas', nf_id, parcelas),
    getProgramacao: (nf_id: number) => ipcRenderer.invoke('nf:getProgramacao', nf_id),
    saveProgramacao: (nf_id: number, items: unknown[]) => ipcRenderer.invoke('nf:saveProgramacao', nf_id, items),
    duplicate: (id: number) => ipcRenderer.invoke('nf:duplicate', id),
    getMinSeq: () => ipcRenderer.invoke('nf:getMinSeq'),
    getFirstNF: () => ipcRenderer.invoke('nf:getFirstNF'),
    stats: (filters?: Record<string, unknown>) => ipcRenderer.invoke('nf:stats', filters),
    exportExcel: (filters?: Record<string, unknown>) => ipcRenderer.invoke('nf:exportExcel', filters),
    getAnexos: (nf_id: number) => ipcRenderer.invoke('nf:getAnexos', nf_id),
    saveAnexos: (nf_id: number, caminhos: string[]) => ipcRenderer.invoke('nf:saveAnexos', nf_id, caminhos),
    deleteAnexo: (id: number) => ipcRenderer.invoke('nf:deleteAnexo', id),
    pickAnexos: () => ipcRenderer.invoke('nf:pickAnexos'),
  },

  // Caixa
  caixa: {
    list: (filters?: Record<string, unknown>) => ipcRenderer.invoke('caixa:list', filters),
    get: (id: number) => ipcRenderer.invoke('caixa:get', id),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('caixa:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('caixa:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('caixa:delete', id),
    fechar: (id: number) => ipcRenderer.invoke('caixa:fechar', id),
    reabrir: (id: number) => ipcRenderer.invoke('caixa:reabrir', id),
    getLancamentos: (caixa_id: number) => ipcRenderer.invoke('caixa:getLancamentos', caixa_id),
    createLancamento: (data: Record<string, unknown>) => ipcRenderer.invoke('caixa:createLancamento', data),
    updateLancamento: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('caixa:updateLancamento', id, data),
    deleteLancamento: (id: number, caixa_id: number) => ipcRenderer.invoke('caixa:deleteLancamento', id, caixa_id),
    getRefeicoes: (caixa_id: number, mes: number, ano: number) => ipcRenderer.invoke('caixa:getRefeicoes', caixa_id, mes, ano),
    upsertRefeicao: (data: Record<string, unknown>) => ipcRenderer.invoke('caixa:upsertRefeicao', data),
    getTotalRefeicoes: (caixa_id: number, mes: number, ano: number, inicio?: string, fim?: string) =>
      ipcRenderer.invoke('caixa:getTotalRefeicoes', caixa_id, mes, ano, inicio, fim),
    getMinNumeroCaixa: () => ipcRenderer.invoke('caixa:getMinNumeroCaixa'),
    getPreviousCaixa: (caixa_id: number) => ipcRenderer.invoke('caixa:getPreviousCaixa', caixa_id),
    getBlockedUntil: (caixa_id: number) => ipcRenderer.invoke('caixa:getBlockedUntil', caixa_id),
    getPrevRefeicaoLancamento: (caixa_id: number) => ipcRenderer.invoke('caixa:getPrevRefeicaoLancamento', caixa_id),
    getLastCaixa: () => ipcRenderer.invoke('caixa:getLastCaixa'),
    exportExcel: (id: number) => ipcRenderer.invoke('caixa:exportExcel', id),
  },

  // Relatórios de Custo
  relatorios: {
    list: () => ipcRenderer.invoke('relatorios:list'),
    save: (nome: string, filtros: string) => ipcRenderer.invoke('relatorios:save', nome, filtros),
    delete: (id: number) => ipcRenderer.invoke('relatorios:delete', id),
  },

  // Print
  print: {
    report: (html: string) => ipcRenderer.invoke('print:report', html),
  },

  // Backup
  backup: {
    export: (modulo?: string) => ipcRenderer.invoke('backup:export', modulo),
    pickFile: () => ipcRenderer.invoke('backup:pickFile'),
    restore: (filePath: string) => ipcRenderer.invoke('backup:restore', filePath),
  },

  // Backup de Cadastros
  cadastros: {
    export: () => ipcRenderer.invoke('cadastros:export'),
    analyze: () => ipcRenderer.invoke('cadastros:analyze'),
    importConfirmed: (filePath: string, decisions: Record<string, string>) => ipcRenderer.invoke('cadastros:importConfirmed', filePath, decisions),
  },

  // Shell
  shell: {
    openFile: (filePath: string) => ipcRenderer.invoke('shell:openFile', filePath),
  },

  // Settings
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
    pickImage: () => ipcRenderer.invoke('settings:pickImage'),
  },

  // SEFAZ Monitor
  sefaz: {
    empresas: {
      list: () => ipcRenderer.invoke('sefaz:empresas:list'),
      create: (data: Record<string, unknown>) => ipcRenderer.invoke('sefaz:empresas:create', data),
      update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('sefaz:empresas:update', id, data),
      delete: (id: number) => ipcRenderer.invoke('sefaz:empresas:delete', id),
      pickPfx: () => ipcRenderer.invoke('sefaz:empresas:pickPfx'),
    },
    nfes: {
      list: (filtros: Record<string, unknown>) => ipcRenderer.invoke('sefaz:nfes:list', filtros),
      buscarXml: (id: number) => ipcRenderer.invoke('sefaz:nfes:buscarXml', id),
      togglePagamento: (id: number) => ipcRenderer.invoke('sefaz:nfes:togglePagamento', id),
      marcarEmailEnviado: (id: number) => ipcRenderer.invoke('sefaz:nfes:marcarEmailEnviado', id),
    },
    consultar: (empresaId: number) => ipcRenderer.invoke('sefaz:consultar', empresaId),
    email: {
      enviar: (dados: Record<string, unknown>) => ipcRenderer.invoke('sefaz:email:enviar', dados),
    },
    destinatarios: {
      list: () => ipcRenderer.invoke('sefaz:destinatarios:list'),
      create: (nome: string, email: string) => ipcRenderer.invoke('sefaz:destinatarios:create', nome, email),
      delete: (id: number) => ipcRenderer.invoke('sefaz:destinatarios:delete', id),
    },
    onProgress: (cb: (msg: string) => void) => {
      ipcRenderer.on('sefaz:progress', (_e, msg) => cb(msg))
      return () => ipcRenderer.removeAllListeners('sefaz:progress')
    },
  },

  // NFS-e Monitor
  nfse: {
    servicos: {
      list:             (filtros?: Record<string, unknown>) => ipcRenderer.invoke('nfse:servicos:list', filtros),
      anosDisponiveis:  (empresaId: number) => ipcRenderer.invoke('nfse:servicos:anosDisponiveis', empresaId),
      buscarXml:           (id: number) => ipcRenderer.invoke('nfse:servicos:buscarXml', id),
      togglePagamento:     (id: number) => ipcRenderer.invoke('nfse:servicos:togglePagamento', id),
      marcarEmailEnviado:  (id: number) => ipcRenderer.invoke('nfse:servicos:marcarEmailEnviado', id),
    },
    consultar:        (empresaId: number) => ipcRenderer.invoke('nfse:consultar', empresaId),
    reimportar:       (empresaId: number) => ipcRenderer.invoke('nfse:reimportar', empresaId),
    verificarEventos: (empresaId: number) => ipcRenderer.invoke('nfse:verificarEventos', empresaId),
    onProgress: (cb: (msg: string) => void) => {
      ipcRenderer.on('nfse:progress', (_e, msg) => cb(msg))
      return () => ipcRenderer.removeAllListeners('nfse:progress')
    },
  },

  // Email
  email: {
    test: () => ipcRenderer.invoke('email:test'),
    sendNF: (payload: { to: string; html: string; nfSeq: number; nfId: number }) =>
      ipcRenderer.invoke('email:sendNF', payload),
    validatePassword: (senha: string) => ipcRenderer.invoke('email:validatePassword', senha),
  },
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
