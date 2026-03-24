import { useEffect, useState, useCallback } from 'react'
import { BarChart2, Eye, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'
import type { RelatorioCusto, Empresa, Unidade, CentroCusto, Fornecedor } from '../../types'
import RelatorioModal from './RelatorioModal'
import ConfirmDialog from '../../components/ConfirmDialog'
import EmptyState from '../../components/EmptyState'

interface FiltrosParsed {
  empresa_id: string
  unidade_id: string
  centro_custo_id: string
  fornecedor_id: string
  status: string
  data_inicio: string
  data_fim: string
}

export default function RelatorioList() {
  const [relatorios, setRelatorios] = useState<RelatorioCusto[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [ccs, setCcs] = useState<CentroCusto[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [viewingFiltros, setViewingFiltros] = useState<FiltrosParsed | null>(null)

  const load = useCallback(async () => {
    const rs = await api.relatorios.list()
    setRelatorios(rs as RelatorioCusto[])
  }, [])

  useEffect(() => {
    load()
    Promise.all([
      api.empresas.list(),
      api.unidades.list(),
      api.centrosCusto.list(),
      api.fornecedores.list(),
    ]).then(([e, u, cc, f]) => {
      setEmpresas(e as Empresa[])
      setUnidades(u as Unidade[])
      setCcs(cc as CentroCusto[])
      setFornecedores(f as Fornecedor[])
    })
  }, [load])

  async function handleDelete() {
    if (!deletingId) return
    await api.relatorios.delete(deletingId)
    setDeletingId(null)
    load()
  }

  function parseFiltros(filtrosJson: string): FiltrosParsed {
    try {
      return JSON.parse(filtrosJson)
    } catch {
      return { empresa_id: '', unidade_id: '', centro_custo_id: '', fornecedor_id: '', status: '', data_inicio: '', data_fim: '' }
    }
  }

  function labelPeriodo(r: RelatorioCusto) {
    const f = parseFiltros(r.filtros)
    if (f.data_inicio || f.data_fim) {
      return `${formatDate(f.data_inicio) ?? '...'} a ${formatDate(f.data_fim) ?? '...'}`
    }
    return 'Todos os períodos'
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 shrink-0">
        <h1 className="text-xl font-bold text-slate-100">Relatórios de Custo</h1>
        <p className="text-sm text-slate-500 mt-1">Relatórios salvos para consulta rápida</p>
      </div>

      {/* Tabela */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {relatorios.length === 0 ? (
          <EmptyState
            icon={<BarChart2 size={48} />}
            title="Nenhum relatório salvo"
            description="Gere um relatório na aba Controle de NF e clique em Salvar para que ele apareça aqui."
          />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Período</th>
                  <th>Criado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {relatorios.map(r => (
                  <tr key={r.id}>
                    <td className="font-medium text-slate-200">{r.nome}</td>
                    <td className="text-slate-400 font-mono text-sm">{labelPeriodo(r)}</td>
                    <td className="text-slate-400">{formatDate(r.created_at?.split(' ')[0])}</td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          className="btn-ghost btn-sm p-1.5 text-blue-400 hover:bg-blue-900/30"
                          title="Visualizar"
                          onClick={() => setViewingFiltros(parseFiltros(r.filtros))}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          className="btn-ghost btn-sm p-1.5 text-red-400 hover:bg-red-900/30"
                          title="Excluir"
                          onClick={() => setDeletingId(r.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modais */}
      {viewingFiltros && (
        <RelatorioModal
          empresas={empresas}
          unidades={unidades}
          ccs={ccs}
          fornecedores={fornecedores}
          initialFilters={viewingFiltros}
          onClose={() => setViewingFiltros(null)}
        />
      )}

      {deletingId !== null && (
        <ConfirmDialog
          title="Excluir Relatório"
          message="Tem certeza que deseja excluir este relatório salvo?"
          confirmLabel="Excluir"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  )
}
