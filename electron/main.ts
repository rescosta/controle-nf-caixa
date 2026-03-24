import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join, basename } from 'path'
import { writeFileSync, copyFileSync, readFileSync } from 'fs'
import { closeDb, getDbPath } from './database/db'
import { empresasQueries, unidadesQueries, centrosCustoQueries, fornecedoresQueries, funcionariosQueries } from './database/queries/cadastros'
import { nfQueries } from './database/queries/nf'
import { nfAnexosQueries } from './database/queries/nfAnexos'
import { caixaQueries } from './database/queries/caixa'
import { relatoriosQueries } from './database/queries/relatorios'
import { settingsQueries } from './database/queries/settings'
import { sendNFEmail, testEmailConnection } from './email/sender'
import { mergePDFs } from './email/pdfMerge'
import { sefazEmpresasQueries, sefazNfesQueries, sefazDestinatariosQueries } from './database/queries/sefaz'
import { consultarSefaz } from './sefaz/consulta'
import { manifestarCiencia } from './sefaz/manifestacao'
import { sendSefazNfeEmail } from './email/sefazSender'

function createWindow(): void {
  const isMac = process.platform === 'darwin'
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    ...(isMac ? { trafficLightPosition: { x: 16, y: 16 } } : {}),
    backgroundColor: '#0f172a',
    show: false,
  })

  win.once('ready-to-show', () => win.show())

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerHandlers()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeDb()
  if (process.platform !== 'darwin') app.quit()
})

// ========== IPC HANDLERS ==========

function registerHandlers(): void {
  // Window controls
  ipcMain.handle('win:platform', () => process.platform)
  ipcMain.handle('win:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.handle('win:maximize', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender)
    if (!w) return
    w.isMaximized() ? w.unmaximize() : w.maximize()
  })
  ipcMain.handle('win:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())
  ipcMain.handle('win:isMaximized', (e) => BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false)

  // Empresas
  ipcMain.handle('empresas:list', () => empresasQueries.list())
  ipcMain.handle('empresas:create', (_, data) => empresasQueries.create(data))
  ipcMain.handle('empresas:update', (_, id, data) => empresasQueries.update(id, data))
  ipcMain.handle('empresas:delete', (_, id) => empresasQueries.delete(id))

  // Unidades
  ipcMain.handle('unidades:list', () => unidadesQueries.list())
  ipcMain.handle('unidades:listByEmpresa', (_, id) => unidadesQueries.listByEmpresa(id))
  ipcMain.handle('unidades:create', (_, data) => unidadesQueries.create(data))
  ipcMain.handle('unidades:update', (_, id, data) => unidadesQueries.update(id, data))
  ipcMain.handle('unidades:delete', (_, id) => unidadesQueries.delete(id))

  // Centros de Custo
  ipcMain.handle('centrosCusto:list', () => centrosCustoQueries.list())
  ipcMain.handle('centrosCusto:create', (_, data) => centrosCustoQueries.create(data))
  ipcMain.handle('centrosCusto:update', (_, id, data) => centrosCustoQueries.update(id, data))
  ipcMain.handle('centrosCusto:delete', (_, id) => centrosCustoQueries.delete(id))

  // Fornecedores
  ipcMain.handle('fornecedores:list', () => fornecedoresQueries.list())
  ipcMain.handle('fornecedores:get', (_, id) => fornecedoresQueries.get(id))
  ipcMain.handle('fornecedores:create', (_, data) => fornecedoresQueries.create(data))
  ipcMain.handle('fornecedores:update', (_, id, data) => fornecedoresQueries.update(id, data))
  ipcMain.handle('fornecedores:delete', (_, id) => fornecedoresQueries.delete(id))

  // Funcionários
  ipcMain.handle('funcionarios:list', () => funcionariosQueries.list())
  ipcMain.handle('funcionarios:create', (_, data) => funcionariosQueries.create(data))
  ipcMain.handle('funcionarios:update', (_, id, data) => funcionariosQueries.update(id, data))
  ipcMain.handle('funcionarios:delete', (_, id) => funcionariosQueries.delete(id))

  // NF
  ipcMain.handle('nf:list', (_, filters) => nfQueries.list(filters))
  ipcMain.handle('nf:get', (_, id) => nfQueries.get(id))
  ipcMain.handle('nf:create', (_, data) => nfQueries.create(data))
  ipcMain.handle('nf:update', (_, id, data) => nfQueries.update(id, data))
  ipcMain.handle('nf:delete', (_, id) => nfQueries.delete(id))
  ipcMain.handle('nf:marcarPago', (_, id, data_pagamento) => nfQueries.marcarPago(id, data_pagamento))
  ipcMain.handle('nf:desfazerPagamento', (_, id) => nfQueries.desfazerPagamento(id))
  ipcMain.handle('nf:getParcelas', (_, nf_id) => nfQueries.getParcelas(nf_id))
  ipcMain.handle('nf:saveParcelas', (_, nf_id, parcelas) => {
    nfQueries.deleteParcelas(nf_id)
    for (const p of parcelas as Record<string, unknown>[]) {
      nfQueries.createParcela({ ...p, nf_id })
    }
  })
  ipcMain.handle('nf:duplicate', (_, id) => nfQueries.duplicate(id))
  ipcMain.handle('nf:getMinSeq', () => nfQueries.getMinSeq())
  ipcMain.handle('nf:getFirstNF', () => nfQueries.getFirstNF())
  ipcMain.handle('nf:getProgramacao', (_, nf_id) => nfQueries.getProgramacao(nf_id))
  ipcMain.handle('nf:saveProgramacao', (_, nf_id, items) => nfQueries.saveProgramacao(nf_id, items))
  ipcMain.handle('nf:stats', (_, filters) => nfQueries.stats(filters))
  ipcMain.handle('nf:exportExcel', async (_, filters) => {
    const { generateNFExcel } = await import('./export/nfExcel')
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showSaveDialog(win!, {
      defaultPath: `NF_${new Date().toISOString().split('T')[0]}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })
    if (!result.canceled && result.filePath) {
      const buffer = generateNFExcel(filters)
      writeFileSync(result.filePath, buffer)
      shell.openPath(result.filePath)
    }
  })

  // Caixa
  ipcMain.handle('caixa:list', (_, filters) => caixaQueries.list(filters))
  ipcMain.handle('caixa:get', (_, id) => caixaQueries.get(id))
  ipcMain.handle('caixa:create', (_, data) => caixaQueries.create(data))
  ipcMain.handle('caixa:update', (_, id, data) => caixaQueries.update(id, data))
  ipcMain.handle('caixa:delete', (_, id) => caixaQueries.delete(id))
  ipcMain.handle('caixa:fechar', (_, id) => caixaQueries.fechar(id))
  ipcMain.handle('caixa:reabrir', (_, id) => caixaQueries.reabrir(id))
  ipcMain.handle('caixa:getLancamentos', (_, caixa_id) => caixaQueries.getLancamentos(caixa_id))
  ipcMain.handle('caixa:createLancamento', (_, data) => caixaQueries.createLancamento(data))
  ipcMain.handle('caixa:updateLancamento', (_, id, data) => caixaQueries.updateLancamento(id, data))
  ipcMain.handle('caixa:deleteLancamento', (_, id, caixa_id) => caixaQueries.deleteLancamento(id, caixa_id))
  ipcMain.handle('caixa:getRefeicoes', (_, caixa_id, mes, ano) => caixaQueries.getRefeicoes(caixa_id, mes, ano))
  ipcMain.handle('caixa:upsertRefeicao', (_, data) => caixaQueries.upsertRefeicao(data))
  ipcMain.handle('caixa:getTotalRefeicoes', (_, caixa_id, mes, ano, inicio, fim) => caixaQueries.getTotalRefeicoes(caixa_id, mes, ano, inicio, fim))
  ipcMain.handle('caixa:getMinNumeroCaixa', () => caixaQueries.getMinNumeroCaixa())
  ipcMain.handle('caixa:getPreviousCaixa', (_, caixa_id) => caixaQueries.getPreviousCaixa(caixa_id))
  ipcMain.handle('caixa:getBlockedUntil', (_, caixa_id) => caixaQueries.getBlockedUntil(caixa_id))
  ipcMain.handle('caixa:getPrevRefeicaoLancamento', (_, caixa_id: number) =>
    caixaQueries.getPrevRefeicaoLancamento(caixa_id)
  )
  ipcMain.handle('caixa:getLastCaixa', () => caixaQueries.getLastCaixa())
  ipcMain.handle('caixa:exportExcel', async (_, id) => {
    const { generateCaixaExcel } = await import('./export/caixaExcel')
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showSaveDialog(win!, {
      defaultPath: `Caixa_${id}_${new Date().toISOString().split('T')[0]}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })
    if (!result.canceled && result.filePath) {
      const buffer = generateCaixaExcel(id)
      writeFileSync(result.filePath, buffer)
      shell.openPath(result.filePath)
    }
  })

  // Relatórios de Custo
  ipcMain.handle('relatorios:list', () => relatoriosQueries.list())
  ipcMain.handle('relatorios:save', (_, nome, filtros) => relatoriosQueries.save(nome, filtros))
  ipcMain.handle('relatorios:delete', (_, id) => relatoriosQueries.delete(id))

  // Print
  ipcMain.handle('print:report', async (_, html: string) => {
    const printWin = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })
    await printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    printWin.webContents.print({ silent: false, printBackground: true }, () => {
      printWin.destroy()
    })
  })

  // Settings
  ipcMain.handle('settings:get', (_, key) => settingsQueries.get(key))
  ipcMain.handle('settings:set', (_, key, value) => settingsQueries.set(key, value))

  ipcMain.handle('shell:openFile', (_, filePath: string) => shell.openPath(filePath))

  ipcMain.handle('settings:pickImage', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)!
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg'] }],
    })
    if (result.canceled || !result.filePaths[0]) return null
    const buf = readFileSync(result.filePaths[0])
    const ext = result.filePaths[0].split('.').pop()?.toLowerCase() ?? 'png'
    return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${buf.toString('base64')}`
  })

  // Email
  ipcMain.handle('email:test', async () => {
    await testEmailConnection()
  })

  ipcMain.handle('email:sendNF', async (_, payload: { to: string; html: string; nfSeq: number; nfId: number }) => {
    const pdfWin = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } })
    await pdfWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(payload.html))
    const nfPdfBuf = await pdfWin.webContents.printToPDF({ printBackground: true, pageSize: 'A4' })
    pdfWin.destroy()
    const anexos = nfAnexosQueries.list(payload.nfId) as { nome: string; caminho: string; tipo: string }[]
    const finalPdf = await mergePDFs(nfPdfBuf, anexos)
    const nf = nfQueries.get(payload.nfId) as { nf_numero?: string; fornecedor_nome?: string; valor_boleto?: number; vencimento?: string } | undefined
    const seqFormatado = String(payload.nfSeq).padStart(5, '0')
    const fmtDate = (d?: string) => d ? d.split('-').reverse().join('/') : '-'
    const fmtBRL = (v?: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    const body = [
      `Segue em anexo Controle de Notas Fiscais ID #${seqFormatado}`,
      '',
      `Nota Fiscal: ${nf?.nf_numero ?? '-'}`,
      `Fornecedor: ${nf?.fornecedor_nome ?? '-'}`,
      `Valor: ${fmtBRL(nf?.valor_boleto)}`,
      `Vencimento: ${fmtDate(nf?.vencimento)}`,
    ].join('\n')
    await sendNFEmail({
      to: payload.to,
      subject: `Controle Notas Fiscais - ID #${seqFormatado}`,
      body,
      pdfBuffer: finalPdf,
      pdfName: `Controle - ID #${seqFormatado}.pdf`,
      anexos: [],
    })
    nfQueries.markEmailEnviado(payload.nfId)
  })

  ipcMain.handle('email:validatePassword', (_, senha: string) =>
    funcionariosQueries.validateEmailPassword(senha)
  )

  // Anexos NF
  ipcMain.handle('nf:getAnexos', (_, nf_id: number) => nfAnexosQueries.list(nf_id))
  ipcMain.handle('nf:deleteAnexo', (_, id: number) => nfAnexosQueries.delete(id))
  ipcMain.handle('nf:saveAnexos', (_, nf_id: number, caminhos: string[]) => {
    for (const caminho of caminhos) {
      const nome = basename(caminho)
      const tipo = caminho.toLowerCase().endsWith('.pdf') ? 'pdf' : 'imagem'
      nfAnexosQueries.create({ nf_id, nome, caminho, tipo })
    }
  })
  ipcMain.handle('nf:pickAnexos', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)!
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'PDF e Imagens', extensions: ['pdf', 'png', 'jpg', 'jpeg'] }],
    })
    return result.canceled ? [] : result.filePaths
  })

  // Backup
  ipcMain.handle('backup:export', async (_, modulo: string = 'completo') => {
    const win = BrowserWindow.getFocusedWindow()
    const date = new Date().toISOString().split('T')[0]
    const result = await dialog.showSaveDialog(win!, {
      defaultPath: `backup-${modulo}-${date}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    })
    if (result.canceled || !result.filePath) return { ok: false, canceled: true }
    const { getDb } = await import('./database/db')
    await getDb().backup(result.filePath)
    shell.showItemInFolder(result.filePath)
    return { ok: true }
  })

  ipcMain.handle('backup:pickFile', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)!
    const result = await dialog.showOpenDialog(win, {
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true }
    const srcPath = result.filePaths[0]
    let header: Buffer
    try { header = readFileSync(srcPath, { encoding: null }).slice(0, 16) } catch { return { ok: false, invalid: true } }
    if (!header.toString('ascii').startsWith('SQLite format 3')) return { ok: false, invalid: true }
    return { ok: true, filePath: srcPath, fileName: basename(srcPath) }
  })

  ipcMain.handle('backup:restore', async (e, srcPath: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)!
    let header: Buffer
    try { header = readFileSync(srcPath, { encoding: null }).slice(0, 16) } catch { return { ok: false, invalid: true } }
    if (!header.toString('ascii').startsWith('SQLite format 3')) return { ok: false, invalid: true }
    const dbPath = getDbPath()
    copyFileSync(dbPath, dbPath + '.bak')
    closeDb()
    copyFileSync(srcPath, dbPath)
    // Retorna { ok: true } antes de recarregar para o frontend mostrar mensagem de sucesso
    setTimeout(() => win.webContents.reload(), 2500)
    return { ok: true }
  })

  // Backup de Cadastros (Empresas, Unidades, Centros de Custo, Funcionários)
  ipcMain.handle('cadastros:export', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const date = new Date().toISOString().split('T')[0]
    const result = await dialog.showSaveDialog(win!, {
      defaultPath: `cadastros-${date}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return { ok: false, canceled: true }
    const { getDb } = await import('./database/db')
    const db = getDb()
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      empresas: db.prepare('SELECT nome, cnpj FROM empresas ORDER BY id').all(),
      unidades: db.prepare(`
        SELECT u.nome, e.nome as empresa_nome
        FROM unidades u LEFT JOIN empresas e ON e.id = u.empresa_id ORDER BY u.id
      `).all(),
      centros_custo: db.prepare('SELECT codigo, descricao FROM centros_custo ORDER BY codigo').all(),
      funcionarios: db.prepare(`
        SELECT f.nome, f.cargo, f.ativo, e.nome as empresa_nome
        FROM funcionarios f LEFT JOIN empresas e ON e.id = f.empresa_id ORDER BY f.id
      `).all(),
    }
    writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8')
    shell.showItemInFolder(result.filePath)
    return { ok: true }
  })

  // Analisa o arquivo JSON sem importar — retorna conflitos para o usuário decidir
  ipcMain.handle('cadastros:analyze', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true }

    let raw: string
    try { raw = readFileSync(result.filePaths[0], 'utf-8') } catch { return { ok: false, invalid: true } }
    let data: Record<string, unknown[]>
    try { data = JSON.parse(raw) } catch { return { ok: false, invalid: true } }
    if (!data.version || !Array.isArray(data.empresas)) return { ok: false, invalid: true }

    const { getDb } = await import('./database/db')
    const db = getDb()

    const existEmpresas = new Set((db.prepare('SELECT lower(nome) as n FROM empresas').all() as {n:string}[]).map(r => r.n))
    const existCCs = new Set((db.prepare('SELECT lower(codigo) as c FROM centros_custo').all() as {c:string}[]).map(r => r.c))
    const existUnidades = new Set(
      (db.prepare(`SELECT lower(u.nome) as nome, lower(coalesce(e.nome,'')) as emp FROM unidades u LEFT JOIN empresas e ON e.id = u.empresa_id`).all() as {nome:string; emp:string}[])
        .map(r => `${r.nome}|${r.emp}`)
    )
    const existFuncs = new Set((db.prepare('SELECT lower(nome) as n FROM funcionarios').all() as {n:string}[]).map(r => r.n))

    const conflictsEmpresas = ((data.empresas ?? []) as {nome:string}[])
      .filter(r => r.nome && existEmpresas.has(r.nome.toLowerCase()))
      .map(r => ({ key: `emp:${r.nome.toLowerCase()}`, label: r.nome }))

    const conflictsCCs = ((data.centros_custo ?? []) as {codigo:string; descricao?:string}[])
      .filter(r => r.codigo && existCCs.has(r.codigo.toLowerCase()))
      .map(r => ({ key: `cc:${r.codigo.toLowerCase()}`, label: `${r.codigo} — ${r.descricao ?? ''}` }))

    const conflictsUnidades = ((data.unidades ?? []) as {nome:string; empresa_nome?:string}[])
      .filter(r => r.nome && existUnidades.has(`${r.nome.toLowerCase()}|${(r.empresa_nome ?? '').toLowerCase()}`))
      .map(r => ({ key: `uni:${r.nome.toLowerCase()}|${(r.empresa_nome ?? '').toLowerCase()}`, label: r.empresa_nome ? `${r.nome} (${r.empresa_nome})` : r.nome }))

    const conflictsFuncs = ((data.funcionarios ?? []) as {nome:string; cargo?:string}[])
      .filter(r => r.nome && existFuncs.has(r.nome.toLowerCase()))
      .map(r => ({ key: `func:${r.nome.toLowerCase()}`, label: r.cargo ? `${r.nome} — ${r.cargo}` : r.nome }))

    return {
      ok: true,
      filePath: result.filePaths[0],
      toImport: {
        empresas: (data.empresas?.length ?? 0) - conflictsEmpresas.length,
        unidades: (data.unidades?.length ?? 0) - conflictsUnidades.length,
        centros_custo: (data.centros_custo?.length ?? 0) - conflictsCCs.length,
        funcionarios: (data.funcionarios?.length ?? 0) - conflictsFuncs.length,
      },
      conflicts: {
        empresas: conflictsEmpresas,
        unidades: conflictsUnidades,
        centros_custo: conflictsCCs,
        funcionarios: conflictsFuncs,
      },
    }
  })

  // Executa a importação com as decisões do usuário para cada conflito
  ipcMain.handle('cadastros:importConfirmed', async (_, filePath: string, decisions: Record<string, 'substituir' | 'ignorar'>) => {
    let raw: string
    try { raw = readFileSync(filePath, 'utf-8') } catch { return { ok: false, invalid: true } }
    let data: Record<string, unknown[]>
    try { data = JSON.parse(raw) } catch { return { ok: false, invalid: true } }
    if (!data.version || !Array.isArray(data.empresas)) return { ok: false, invalid: true }

    const { getDb } = await import('./database/db')
    const db = getDb()
    const stats = {
      empresas: { imported: 0, replaced: 0, skipped: 0 },
      unidades: { imported: 0, replaced: 0, skipped: 0 },
      centros_custo: { imported: 0, replaced: 0, skipped: 0 },
      funcionarios: { imported: 0, replaced: 0, skipped: 0 },
    }

    // Empresas
    const existEmpresas = new Set((db.prepare('SELECT lower(nome) as n FROM empresas').all() as {n:string}[]).map(r => r.n))
    for (const row of (data.empresas ?? []) as {nome:string; cnpj?:string}[]) {
      if (!row.nome) continue
      const k = row.nome.toLowerCase()
      if (existEmpresas.has(k)) {
        if ((decisions[`emp:${k}`] ?? 'ignorar') === 'substituir') {
          db.prepare('UPDATE empresas SET cnpj=? WHERE lower(nome)=lower(?)').run(row.cnpj ?? null, row.nome)
          stats.empresas.replaced++
        } else { stats.empresas.skipped++ }
      } else {
        db.prepare('INSERT INTO empresas (nome, cnpj) VALUES (?, ?)').run(row.nome, row.cnpj ?? null)
        existEmpresas.add(k)
        stats.empresas.imported++
      }
    }

    // Centros de Custo
    const existCCs = new Set((db.prepare('SELECT lower(codigo) as c FROM centros_custo').all() as {c:string}[]).map(r => r.c))
    for (const row of (data.centros_custo ?? []) as {codigo:string; descricao?:string}[]) {
      if (!row.codigo) continue
      const k = row.codigo.toLowerCase()
      if (existCCs.has(k)) {
        if ((decisions[`cc:${k}`] ?? 'ignorar') === 'substituir') {
          db.prepare('UPDATE centros_custo SET descricao=? WHERE lower(codigo)=lower(?)').run(row.descricao ?? '', row.codigo)
          stats.centros_custo.replaced++
        } else { stats.centros_custo.skipped++ }
      } else {
        db.prepare('INSERT INTO centros_custo (codigo, descricao) VALUES (?, ?)').run(row.codigo, row.descricao ?? '')
        existCCs.add(k)
        stats.centros_custo.imported++
      }
    }

    // Unidades
    const existUnidades = new Set(
      (db.prepare(`SELECT lower(u.nome) as nome, lower(coalesce(e.nome,'')) as emp FROM unidades u LEFT JOIN empresas e ON e.id = u.empresa_id`).all() as {nome:string; emp:string}[])
        .map(r => `${r.nome}|${r.emp}`)
    )
    for (const row of (data.unidades ?? []) as {nome:string; empresa_nome?:string}[]) {
      if (!row.nome) continue
      const uniKey = `${row.nome.toLowerCase()}|${(row.empresa_nome ?? '').toLowerCase()}`
      const empRow = row.empresa_nome
        ? (db.prepare('SELECT id FROM empresas WHERE lower(nome)=lower(?)').get(row.empresa_nome) as {id:number} | undefined)
        : undefined
      if (existUnidades.has(uniKey)) {
        if ((decisions[`uni:${uniKey}`] ?? 'ignorar') === 'substituir') {
          db.prepare(`UPDATE unidades SET empresa_id=? WHERE lower(nome)=lower(?) AND lower(coalesce((SELECT nome FROM empresas WHERE id=empresa_id),''))=lower(?)`).run(empRow?.id ?? null, row.nome, row.empresa_nome ?? '')
          stats.unidades.replaced++
        } else { stats.unidades.skipped++ }
      } else {
        db.prepare('INSERT INTO unidades (nome, empresa_id) VALUES (?, ?)').run(row.nome, empRow?.id ?? null)
        existUnidades.add(uniKey)
        stats.unidades.imported++
      }
    }

    // Funcionários
    const existFuncs = new Set((db.prepare('SELECT lower(nome) as n FROM funcionarios').all() as {n:string}[]).map(r => r.n))
    for (const row of (data.funcionarios ?? []) as {nome:string; cargo?:string; ativo?:number; empresa_nome?:string}[]) {
      if (!row.nome) continue
      const k = row.nome.toLowerCase()
      const empRow = row.empresa_nome
        ? (db.prepare('SELECT id FROM empresas WHERE lower(nome)=lower(?)').get(row.empresa_nome) as {id:number} | undefined)
        : undefined
      if (existFuncs.has(k)) {
        if ((decisions[`func:${k}`] ?? 'ignorar') === 'substituir') {
          db.prepare('UPDATE funcionarios SET cargo=?, empresa_id=?, ativo=? WHERE lower(nome)=lower(?)').run(row.cargo ?? null, empRow?.id ?? null, row.ativo ?? 1, row.nome)
          stats.funcionarios.replaced++
        } else { stats.funcionarios.skipped++ }
      } else {
        db.prepare('INSERT INTO funcionarios (nome, cargo, empresa_id, ativo) VALUES (?, ?, ?, ?)').run(row.nome, row.cargo ?? null, empRow?.id ?? null, row.ativo ?? 1)
        existFuncs.add(k)
        stats.funcionarios.imported++
      }
    }

    return { ok: true, stats }
  })

  // ========== SEFAZ Monitor ==========

  // Empresas SEFAZ
  ipcMain.handle('sefaz:empresas:list', () => sefazEmpresasQueries.list())
  ipcMain.handle('sefaz:empresas:create', (_, data) => sefazEmpresasQueries.create(data))
  ipcMain.handle('sefaz:empresas:update', (_, id, data) => sefazEmpresasQueries.update(id, data))
  ipcMain.handle('sefaz:empresas:delete', (_, id) => sefazEmpresasQueries.delete(id))
  ipcMain.handle('sefaz:empresas:pickPfx', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)!
    const result = await dialog.showOpenDialog(win, {
      title: 'Selecionar Certificado Digital (.pfx)',
      filters: [{ name: 'Certificado A1', extensions: ['pfx', 'p12'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const buffer = readFileSync(result.filePaths[0])
    return buffer.toString('base64')
  })

  // NF-es SEFAZ
  ipcMain.handle('sefaz:nfes:list', (_, filtros) => sefazNfesQueries.list(filtros))
  ipcMain.handle('sefaz:nfes:buscarXml', (_, id) => sefazNfesQueries.buscarXml(id))
  ipcMain.handle('sefaz:nfes:togglePagamento', (_, id) => { sefazNfesQueries.togglePagamento(id); return true })
  ipcMain.handle('sefaz:nfes:marcarEmailEnviado', (_, id) => { sefazNfesQueries.marcarEmailEnviado(id); return true })

  // Consulta SEFAZ
  ipcMain.handle('sefaz:consultar', async (event, empresaId: number) => {
    const empresa = sefazEmpresasQueries.get(empresaId)
    if (!empresa) throw new Error('Empresa SEFAZ não encontrada.')

    const win = BrowserWindow.fromWebContents(event.sender)
    const onProgress = (msg: string) => win?.webContents.send('sefaz:progress', msg)

    // Verificar cooldown
    const estado = sefazEmpresasQueries.getEstadoRateLimit(empresaId)
    if (estado.cooldown) {
      const agora = new Date()
      const ate = new Date(estado.cooldown)
      if (agora < ate) {
        const mins = Math.ceil((ate.getTime() - agora.getTime()) / 60000)
        throw new Error(`SEFAZ_COOLDOWN:${mins}`)
      } else {
        sefazEmpresasQueries.limparCooldown(empresaId)
      }
    }

    // Verificar limite diário (19 consultas/dia)
    const hoje = new Date().toISOString().slice(0, 10)
    const consultasHoje = estado.data === hoje ? estado.count : 0
    if (consultasHoje >= 19) {
      throw new Error('SEFAZ_LIMITE:Limite diário de 19 consultas atingido. Tente amanhã.')
    }

    sefazEmpresasQueries.registrarConsulta(empresaId)
    onProgress(`Consultas restantes hoje: ${19 - consultasHoje - 1}`)

    const resultado = await consultarSefaz(empresa, onProgress)

    if (resultado.cStat656) {
      sefazEmpresasQueries.ativarCooldown(empresaId)
      throw new Error('SEFAZ_COOLDOWN:65')
    }

    let novas = 0
    let atualizadas = 0

    for (const nfe of resultado.nfes) {
      const dados = {
        empresa_id: empresaId,
        chave_acesso: nfe.chave_acesso,
        nsu: nfe.nsu,
        nf_numero: nfe.nf_numero,
        nf_data: nfe.nf_data,
        fornecedor_cnpj: nfe.fornecedor_cnpj,
        fornecedor_nome: nfe.fornecedor_nome,
        valor_nota: nfe.valor_nota,
        xml_blob: nfe.xml,
        tipo_nfe: nfe.tipo_nfe,
      }
      if (nfe.tipo_nfe === 'procNFe') {
        const atualizou = sefazNfesQueries.atualizarCompleta(nfe.chave_acesso, { nf_numero: nfe.nf_numero, xml_blob: nfe.xml })
        if (atualizou) { atualizadas++ } else { sefazNfesQueries.inserir(dados); novas++ }
      } else {
        sefazNfesQueries.inserir(dados)
        novas++
      }
    }

    sefazEmpresasQueries.atualizarNsu(empresaId, resultado.ultimoNsu)

    let manifestados = 0
    let errosManifestacao = 0
    if (resultado.chavesResNfe.length > 0) {
      onProgress(`Manifestando ciência para ${resultado.chavesResNfe.length} resumo(s)...`)
      try {
        const m = await manifestarCiencia(empresa, resultado.chavesResNfe, onProgress)
        manifestados = m.manifestados
        errosManifestacao = m.erros
      } catch (e: any) {
        errosManifestacao = resultado.chavesResNfe.length
      }
    }

    return { total: novas, atualizadas, manifestados, errosManifestacao, temMais: resultado.temMais }
  })

  // Email SEFAZ
  ipcMain.handle('sefaz:email:enviar', async (_, dados) => {
    await sendSefazNfeEmail(dados)
    return true
  })

  // Destinatários SEFAZ
  ipcMain.handle('sefaz:destinatarios:list', () => sefazDestinatariosQueries.list())
  ipcMain.handle('sefaz:destinatarios:create', (_, nome, email) => sefazDestinatariosQueries.create(nome, email))
  ipcMain.handle('sefaz:destinatarios:delete', (_, id) => sefazDestinatariosQueries.delete(id))
}
