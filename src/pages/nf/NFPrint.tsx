import { useEffect, useState } from 'react'
import { X, Printer } from 'lucide-react'
import { api } from '../../lib/api'
import { formatBRL, formatDate } from '../../lib/format'
import type { NotaFiscal, NFParcela, NFProgramacao } from '../../types'

interface Props {
  nf: NotaFiscal
  onClose: () => void
}

const FORMA_LABEL: Record<string, string> = {
  boleto: 'Boleto',
  pix: 'PIX',
  transferencia: 'Transferência Bancária',
}

export default function NFPrintModal({ nf, onClose }: Props) {
  const [parcelas, setParcelas] = useState<NFParcela[]>([])
  const [programacao, setProgramacao] = useState<NFProgramacao[]>([])

  useEffect(() => {
    api.nf.getParcelas(nf.id).then(p => setParcelas(p as NFParcela[]))
    api.nf.getProgramacao(nf.id).then(p => setProgramacao(p as NFProgramacao[]))
  }, [nf.id])

  async function handlePrint() {
    const html = buildNFHtml(nf, parcelas, programacao)
    await api.print.report(html)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Barra de ações */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <span className="font-semibold text-slate-700">Preview de Impressão — NF #{nf.numero_seq}</span>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              <Printer size={14} /> Imprimir / PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Preview scrollável */}
        <div className="overflow-auto flex-1 p-6 bg-slate-100">
          <NFPrintLayout nf={nf} parcelas={parcelas} programacao={programacao} />
        </div>
      </div>
    </div>
  )
}

function NFPrintLayout({ nf, parcelas, programacao }: { nf: NotaFiscal; parcelas: NFParcela[]; programacao: NFProgramacao[] }) {
  const forma = nf.forma_pagamento ?? 'boleto'

  return (
    <div
      className="bg-white text-slate-900"
      style={{ fontFamily: 'Arial, sans-serif', fontSize: 12, padding: '32px' }}
    >
      {/* Cabeçalho */}
      <div style={{ borderBottom: '2px solid #1e293b', paddingBottom: 16, marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1e293b' }}>
          Nota Fiscal — Controle Interno
        </h1>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, color: '#475569', fontSize: 11 }}>
          <span>Seq: <strong>#{nf.numero_seq}</strong></span>
          <span>Lançamento: <strong>{formatDate(nf.data_lancamento)}</strong></span>
        </div>
      </div>

      {/* Empresa / Unidade — CC na coluna direita libera espaço para o nome */}
      <SectionTable title="Empresa / Unidade" rows={[
        ['Empresa', nf.empresa_nome, 'Centro de Custo', nf.cc_codigo ? `${nf.cc_codigo} — ${nf.cc_descricao ?? ''}` : null],
        ['Unidade', nf.unidade_nome],
      ]} />

      {/* Dados da NF */}
      <SectionTable title="Dados da Nota Fiscal" rows={[
        ['Nº NF', nf.nf_numero, 'Data NF', formatDate(nf.nf_data)],
        ['Fornecedor', nf.fornecedor_nome],
        ...(nf.descricao ? [['Descrição', nf.descricao] as Row4] : []),
      ]} />

      {/* Valores */}
      <SectionTable title="Valores" rows={[
        ['Valor da Nota', formatBRL(nf.valor_nota), 'Valor à Pagar', formatBRL(nf.valor_boleto)],
        ['Vencimento', formatDate(nf.vencimento), 'Status', nf.status === 'pago' ? `Pago em ${formatDate(nf.data_pagamento)}` : 'A Pagar'],
      ]} />

      {/* Forma de pagamento — detalhes bancários/PIX na coluna direita */}
      <SectionTable title="Forma de Pagamento" rows={[
        ['Forma', FORMA_LABEL[forma],
          forma === 'pix' ? 'Chave PIX' : forma === 'transferencia' ? 'Banco' : null,
          forma === 'pix' ? nf.pix_chave : forma === 'transferencia' ? nf.banco_pagamento : null],
        ...(forma === 'transferencia' ? [
          ['Agência', nf.agencia_pagamento, 'Conta', nf.conta_pagamento] as Row4,
        ] : []),
      ]} />

      {/* Parcelas */}
      {parcelas.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#64748b', borderBottom: '1px solid #e2e8f0', paddingBottom: 4, marginBottom: 8 }}>
            Parcelas
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                {['Parcela', 'Valor', 'Vencimento', 'Status'].map(h => (
                  <th key={h} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #cbd5e1', color: '#475569' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parcelas.map(p => {
                const tdStyle = { padding: '5px 8px', color: '#1e293b' }
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={tdStyle}>{p.numero_parcela}/{parcelas.length}</td>
                    <td style={tdStyle}>{formatBRL(p.valor)}</td>
                    <td style={tdStyle}>{formatDate(p.vencimento)}</td>
                    <td style={tdStyle}>{p.status === 'pago' ? `Pago ${formatDate(p.data_pagamento)}` : 'A Pagar'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Programação de Pagamentos */}
      {programacao.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#64748b', borderBottom: '1px solid #e2e8f0', paddingBottom: 4, marginBottom: 8 }}>
            Programação de Pagamentos
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                {['Valor', 'Vencimento', 'Observação'].map(h => (
                  <th key={h} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #cbd5e1', color: '#475569' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {programacao.map((p, i) => {
                const tdStyle = { padding: '5px 8px', color: '#1e293b' }
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={tdStyle}>{formatBRL(p.valor)}</td>
                    <td style={tdStyle}>{formatDate(p.vencimento)}</td>
                    <td style={tdStyle}>{p.observacao ?? '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Assinatura */}
      <div style={{ marginTop: 64, display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: '45%', textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #475569', paddingTop: 6, color: '#475569', fontSize: 11 }}>
            Assinatura
          </div>
        </div>
      </div>
    </div>
  )
}

type Row4 = [string, string | null | undefined, string?, string | null | undefined?]

const TD_LABEL: React.CSSProperties = { color: '#64748b', whiteSpace: 'nowrap', verticalAlign: 'top', paddingRight: 8, paddingBottom: 5 }
const TD_VALUE: React.CSSProperties = { fontWeight: 500, color: '#1e293b', verticalAlign: 'top', paddingRight: 24, paddingBottom: 5, wordBreak: 'break-word' }

function SectionTable({ title, rows }: { title: string; rows: Row4[] }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#64748b', borderBottom: '1px solid #e2e8f0', paddingBottom: 4, marginBottom: 8 }}>
        {title}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '18%' }} />
          <col style={{ width: '32%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '32%' }} />
        </colgroup>
        <tbody>
          {rows.map(([l1, v1, l2, v2], i) => (
            <tr key={i}>
              <td style={TD_LABEL}>{l1}:</td>
              {l2
                ? <><td style={TD_VALUE}>{v1 ?? '-'}</td><td style={TD_LABEL}>{l2}:</td><td style={{ ...TD_VALUE, paddingRight: 0 }}>{v2 ?? '-'}</td></>
                : <td colSpan={3} style={{ ...TD_VALUE, paddingRight: 0 }}>{v1 ?? '-'}</td>
              }
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function buildNFHtml(nf: NotaFiscal, parcelas: NFParcela[], programacao: NFProgramacao[], assinaturaImg?: string): string {
  const fmt = (v: number | null | undefined) =>
    v == null ? 'R$ 0,00' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
  const fmtD = (d: string | null | undefined) => {
    if (!d) return '-'
    const [y, m, day] = d.split('-')
    return (!y || !m || !day) ? d : `${day}/${m}/${y}`
  }
  const forma = nf.forma_pagamento ?? 'boleto'
  const formaLabel: Record<string, string> = { boleto: 'Boleto', pix: 'PIX', transferencia: 'Transferência Bancária' }

  const tdL = `style="color:#64748b;white-space:nowrap;vertical-align:top;padding:0 8px 5px 0;width:14%"`
  const tdV = `style="font-weight:500;color:#1e293b;vertical-align:top;padding:0 24px 5px 0;width:36%"`
  const tdVL = `style="font-weight:500;color:#1e293b;vertical-align:top;padding:0 0 5px 0;width:36%"`

  const tr = (l1: string, v1: string | null | undefined, l2?: string | null, v2?: string | null) =>
    l2
      ? `<tr><td ${tdL}>${l1}:</td><td ${tdV}>${v1 ?? '-'}</td><td ${tdL}>${l2}:</td><td ${tdVL}>${v2 ?? '-'}</td></tr>`
      : `<tr><td ${tdL}>${l1}:</td><td colspan="3" ${tdVL}>${v1 ?? '-'}</td></tr>`

  const section = (title: string, rows: string) =>
    `<div style="margin-bottom:16px">
      <div style="font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:8px">${title}</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed">
        <colgroup><col style="width:18%"><col style="width:32%"><col style="width:18%"><col style="width:32%"></colgroup>
        <tbody>${rows}</tbody>
      </table>
    </div>`

  const parcelasHtml = parcelas.length === 0 ? '' : `
    <div style="margin-top:20px">
      <div style="font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:8px">Parcelas</div>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr style="background:#f1f5f9">
          ${['Parcela','Valor','Vencimento','Status'].map(h => `<th style="padding:6px 8px;text-align:left;border-bottom:1px solid #cbd5e1;color:#475569">${h}</th>`).join('')}
        </tr></thead>
        <tbody>${parcelas.map(p => `<tr style="border-bottom:1px solid #e2e8f0">
          <td style="padding:5px 8px">${p.numero_parcela}/${parcelas.length}</td>
          <td style="padding:5px 8px">${fmt(p.valor)}</td>
          <td style="padding:5px 8px">${fmtD(p.vencimento)}</td>
          <td style="padding:5px 8px">${p.status === 'pago' ? `Pago ${fmtD(p.data_pagamento)}` : 'A Pagar'}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>NF #${nf.numero_seq}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;color:#1e293b;background:#fff;padding:32px}@page{margin:15mm}</style>
</head><body>
  <div style="border-bottom:2px solid #1e293b;padding-bottom:16px;margin-bottom:20px">
    <h1 style="font-size:18px;font-weight:700;color:#1e293b">Nota Fiscal — Controle Interno</h1>
    <div style="display:flex;justify-content:space-between;margin-top:8px;color:#475569;font-size:11px">
      <span>Seq: <strong>#${nf.numero_seq}</strong></span>
      <span>Lançamento: <strong>${fmtD(nf.data_lancamento)}</strong></span>
    </div>
  </div>
  ${section('Empresa / Unidade',
    tr('Empresa', nf.empresa_nome, 'Centro de Custo', nf.cc_codigo ? `${nf.cc_codigo} — ${nf.cc_descricao ?? ''}` : null) +
    tr('Unidade', nf.unidade_nome)
  )}
  ${section('Dados da Nota Fiscal',
    tr('Nº NF', nf.nf_numero, 'Data NF', fmtD(nf.nf_data)) +
    tr('Fornecedor', nf.fornecedor_nome) +
    (nf.descricao ? tr('Descrição', nf.descricao) : '')
  )}
  ${section('Valores',
    tr('Valor da Nota', fmt(nf.valor_nota), 'Valor à Pagar', fmt(nf.valor_boleto)) +
    tr('Vencimento', fmtD(nf.vencimento), 'Status', nf.status === 'pago' ? `Pago em ${fmtD(nf.data_pagamento)}` : 'A Pagar')
  )}
  ${section('Forma de Pagamento',
    tr('Forma', formaLabel[forma],
      forma === 'pix' ? 'Chave PIX' : forma === 'transferencia' ? 'Banco' : null,
      forma === 'pix' ? nf.pix_chave : forma === 'transferencia' ? nf.banco_pagamento : null) +
    (forma === 'transferencia' ? tr('Agência', nf.agencia_pagamento, 'Conta', nf.conta_pagamento) : '')
  )}
  ${parcelasHtml}
  ${programacao.length === 0 ? '' : `
  <div style="margin-top:20px">
    <div style="font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:8px">Programação de Pagamentos</div>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead><tr style="background:#f1f5f9">
        ${['Valor','Vencimento','Observação'].map(h => `<th style="padding:6px 8px;text-align:left;border-bottom:1px solid #cbd5e1;color:#475569">${h}</th>`).join('')}
      </tr></thead>
      <tbody>${programacao.map(p => `<tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:5px 8px">${fmt(p.valor)}</td>
        <td style="padding:5px 8px">${fmtD(p.vencimento)}</td>
        <td style="padding:5px 8px">${p.observacao ?? '-'}</td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`}
  <div style="margin-top:64px;display:flex;justify-content:flex-end">
    <div style="width:45%;text-align:center">
      ${assinaturaImg ? `<img src="${assinaturaImg}" style="max-height:60px;margin-bottom:6px;object-fit:contain" />` : ''}
      <div style="border-top:1px solid #475569;padding-top:6px;color:#475569;font-size:11px">Assinatura</div>
    </div>
  </div>
</body></html>`
}
