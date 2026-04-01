import { useState } from 'react'
import {
  FileText, Wallet, Radio, BarChart2, Settings, Calculator,
  ChevronRight, ChevronDown, Info, CheckCircle2, AlertCircle, Mail,
  Upload, Download, Copy, Trash2, ArrowUpRight, History
} from 'lucide-react'

type Section = {
  id: string
  label: string
  icon: React.ReactNode
  content: React.ReactNode
}

export default function ManualPage() {
  const [openSection, setOpenSection] = useState<string>('nf')

  const sections: Section[] = [
    {
      id: 'nf',
      label: 'Controle de NF',
      icon: <FileText size={16} />,
      content: <SecaoControleNF />,
    },
    {
      id: 'caixa',
      label: 'Acerto de Caixa',
      icon: <Wallet size={16} />,
      content: <SecaoAcertoCaixa />,
    },
    {
      id: 'sefaz',
      label: 'Monitor NF-e',
      icon: <Radio size={16} />,
      content: <SecaoSefaz />,
    },
    {
      id: 'impostos',
      label: 'Impostos (Lucro Presumido)',
      icon: <Calculator size={16} />,
      content: <SecaoImpostos />,
    },
    {
      id: 'relatorios',
      label: 'Relatórios de Custo',
      icon: <BarChart2 size={16} />,
      content: <SecaoRelatorios />,
    },
    {
      id: 'config',
      label: 'Configurações',
      icon: <Settings size={16} />,
      content: <SecaoConfiguracoes />,
    },
  ]

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 shrink-0 border-r border-slate-800 bg-slate-900 overflow-y-auto">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Info size={15} className="text-blue-400" />
            Manual do Sistema
          </h2>
          <p className="text-xs text-slate-500 mt-1">Guia de uso completo</p>
        </div>
        <nav className="py-2">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setOpenSection(s.id)}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition ${
                openSection === s.id
                  ? 'bg-blue-500/10 text-blue-400 border-r-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 bg-slate-950">
        <div className="max-w-3xl">
          {sections.find(s => s.id === openSection)?.content}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Helpers de layout                                                    */
/* ------------------------------------------------------------------ */

function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="text-xl font-bold text-slate-100 mb-1">{children}</h1>
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-slate-200 mt-8 mb-3 border-b border-slate-800 pb-1">{children}</h2>
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-400 leading-relaxed mb-3">{children}</p>
}
function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-slate-400 mb-1.5">
      <ChevronRight size={13} className="text-blue-500 mt-0.5 shrink-0" />
      <span>{children}</span>
    </li>
  )
}
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 my-3">
      <CheckCircle2 size={14} className="text-blue-400 mt-0.5 shrink-0" />
      <p className="text-xs text-blue-300 leading-relaxed">{children}</p>
    </div>
  )
}
function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 my-3">
      <AlertCircle size={14} className="text-amber-400 mt-0.5 shrink-0" />
      <p className="text-xs text-amber-300 leading-relaxed">{children}</p>
    </div>
  )
}
function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-slate-700">
            {headers.map(h => (
              <th key={h} className="text-left px-3 py-2 text-slate-400 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-slate-300">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Seções                                                               */
/* ------------------------------------------------------------------ */

function SecaoControleNF() {
  return (
    <>
      <H1>Controle de NF</H1>
      <P>Gerencie todo o ciclo de vida das Notas Fiscais a pagar: cadastro, acompanhamento de vencimentos, pagamento e envio por e-mail.</P>

      <H2>Cadastrando uma Nova NF</H2>
      <P>Clique em <strong className="text-slate-200">+ Nova NF</strong> no canto superior direito. Preencha os campos:</P>
      <ul className="mb-4">
        <Li><strong className="text-slate-200">Empresa / Unidade / Centro de Custo</strong> — vincula a NF à estrutura organizacional.</Li>
        <Li><strong className="text-slate-200">Fornecedor</strong> — selecione ou cadastre diretamente pelo campo (vai para Configurações → Fornecedores).</Li>
        <Li><strong className="text-slate-200">Número da NF / Data da NF</strong> — dados do documento fiscal.</Li>
        <Li><strong className="text-slate-200">Valor da Nota / Valor do Boleto</strong> — podem diferir (ex: descontos ou acréscimos).</Li>
        <Li><strong className="text-slate-200">Vencimento</strong> — data limite para pagamento. Após essa data o status muda automaticamente para <em>Atrasado</em>.</Li>
        <Li><strong className="text-slate-200">Forma de Pagamento</strong> — Boleto, PIX ou Transferência. Campos específicos aparecem conforme a seleção.</Li>
        <Li><strong className="text-slate-200">Descrição</strong> — texto livre para identificar o serviço ou produto.</Li>
      </ul>
      <Tip>O número sequencial é gerado automaticamente. Para definir o número de partida, acesse Configurações → Sequência Inicial de NF.</Tip>

      <H2>Status das NFs</H2>
      <Table
        headers={['Status', 'Cor', 'Significado']}
        rows={[
          ['Pendente', 'Cinza', 'NF importada do SEFAZ, aguarda revisão do usuário'],
          ['A Pagar', 'Amarelo', 'NF cadastrada, dentro do prazo'],
          ['Atrasado', 'Vermelho', 'Vencimento já passou sem pagamento'],
          ['Pago', 'Verde', 'Pagamento registrado com data'],
        ]}
      />
      <Tip>NFs com status <em>Pendente</em> mudam automaticamente para <em>A Pagar</em> ao serem editadas pela primeira vez.</Tip>

      <H2>Marcando como Pago</H2>
      <P>Na listagem, clique no botão <strong className="text-slate-200">Marcar como pago</strong> (ícone de check) na linha da NF. Um modal pedirá a data de pagamento. Para desfazer, clique no ícone de desfazer na linha.</P>

      <H2>Parcelas</H2>
      <P>Dentro do formulário da NF, a aba <strong className="text-slate-200">Parcelas</strong> permite dividir o valor em múltiplos vencimentos. Cada parcela tem valor, data de vencimento e status independente.</P>

      <H2>Programação de Pagamentos</H2>
      <P>A aba <strong className="text-slate-200">Programação</strong> é um controle financeiro futuro separado das parcelas — útil para planejar fluxo de caixa sem alterar as parcelas formais da NF.</P>

      <H2>Duplicar NF</H2>
      <P>Clique no ícone <Copy size={12} className="inline" /> (duplicar) na linha para criar uma cópia da NF com novo número sequencial e status <em>A Pagar</em>. Útil para NFs recorrentes.</P>

      <H2>Enviar por E-mail</H2>
      <P>Clique no ícone <Mail size={12} className="inline" /> (e-mail) para enviar os dados da NF por e-mail. Requer SMTP configurado em <strong className="text-slate-200">Configurações → E-mail</strong>.</P>

      <H2>Filtros</H2>
      <P>Use os filtros no topo da listagem para localizar NFs por empresa, unidade, centro de custo, fornecedor, status e período de vencimento. Os filtros são combinados.</P>

      <H2>Dashboard</H2>
      <P>Cards no topo mostram: total a pagar (soma dos valores pendentes), quantidade vencendo hoje e quantidade vencida. Os valores refletem os filtros ativos.</P>
    </>
  )
}

function SecaoAcertoCaixa() {
  return (
    <>
      <H1>Acerto de Caixa</H1>
      <P>Controle diário de movimentação de caixa por funcionário.</P>

      <H2>Registrando um Acerto</H2>
      <ul className="mb-4">
        <Li>Selecione o <strong className="text-slate-200">funcionário</strong> e a <strong className="text-slate-200">data</strong> do acerto.</Li>
        <Li>Registre entradas e saídas do dia.</Li>
        <Li>O saldo é calculado automaticamente.</Li>
      </ul>

      <H2>Refeições Mensais</H2>
      <P>Dentro de cada funcionário, a aba <strong className="text-slate-200">Refeições</strong> registra almoço e jantar por dia do mês, para controle de benefícios alimentação.</P>

      <Tip>Funcionários são cadastrados em Configurações → Funcionários.</Tip>
    </>
  )
}

function SecaoSefaz() {
  return (
    <>
      <H1>Monitor NF-e</H1>
      <P>Consulta e importação de documentos fiscais eletrônicos (NF-e e NFS-e) diretamente dos serviços da SEFAZ e da Prefeitura.</P>

      <H2>Empresas SEFAZ</H2>
      <P>Antes de consultar documentos, cadastre as empresas com seus certificados digitais:</P>
      <ul className="mb-4">
        <Li>Clique em <strong className="text-slate-200">+ Nova Empresa</strong>.</Li>
        <Li>Informe CNPJ, razão social e ambiente (Produção ou Homologação).</Li>
        <Li>Faça upload do certificado A1 <strong className="text-slate-200">(.pfx)</strong> e informe a senha.</Li>
        <Li>Salve. A empresa ficará disponível nas abas de consulta.</Li>
      </ul>
      <Warn>O certificado digital é armazenado somente localmente. Nunca é enviado para servidores externos.</Warn>

      <H2>NF-es Recebidas</H2>
      <P>Consulta documentos fiscais eletrônicos destinados às suas empresas via SEFAZ (DFe — Distribuição de Documentos Fiscais).</P>
      <ul className="mb-4">
        <Li>Selecione a empresa e clique em <strong className="text-slate-200">Consultar NF-es</strong>.</Li>
        <Li>O sistema buscará todos os documentos a partir do último NSU registrado.</Li>
        <Li>Clique em <Download size={12} className="inline" /> para baixar o XML.</Li>
        <Li>Clique em <Mail size={12} className="inline" /> para enviar o XML por e-mail.</Li>
        <Li>Clique em <ArrowUpRight size={12} className="inline" /> para exportar os dados para o <strong className="text-slate-200">Controle de NF</strong>.</Li>
      </ul>
      <Tip>O CNPJ do destinatário no XML é lido automaticamente para pré-preencher a empresa no modal de exportação.</Tip>

      <H2>NFS-e Tomadas</H2>
      <P>Consulta Notas Fiscais de Serviço (NFS-e) via API ADN Nacional por CNPJ. A API retorna <em>todas</em> as NFS-e vinculadas ao CNPJ — tanto emitidas quanto recebidas.</P>
      <ul className="mb-4">
        <Li>Selecione a empresa e clique em <strong className="text-slate-200">Consultar NFS-e</strong>.</Li>
        <Li>O sistema percorre todos os NSUs disponíveis automaticamente.</Li>
        <Li>Clique em <Mail size={12} className="inline" /> para enviar os dados por e-mail.</Li>
        <Li>Clique em <ArrowUpRight size={12} className="inline" /> para exportar uma NFS-e <em>recebida</em> para o <strong className="text-slate-200">Controle de NF</strong>.</Li>
      </ul>

      <H2>Classificação Emitida / Recebida</H2>
      <P>Cada NFS-e é classificada automaticamente com base no CNPJ do prestador:</P>
      <ul className="mb-4">
        <Li><span className="inline-block px-1.5 py-0.5 rounded text-xs bg-violet-500/20 text-violet-300 font-medium">Emitida</span> — a empresa consultada <em>é o prestador</em> (nota de serviço que ela emitiu para um cliente).</Li>
        <Li><span className="inline-block px-1.5 py-0.5 rounded text-xs bg-blue-500/20 text-blue-300 font-medium">Recebida</span> — a empresa consultada <em>é o tomador</em> (serviço contratado de um fornecedor).</Li>
      </ul>
      <P>Use o filtro <strong className="text-slate-200">Tipo</strong> no topo da lista para exibir apenas emitidas ou apenas recebidas.</P>
      <Tip>As NFS-e emitidas alimentam automaticamente a calculadora de Impostos (aba Impostos). As recebidas podem ser exportadas para o Controle de NF.</Tip>
      <Warn>Se você usa a integração BHISS (BH municipal antigo), não filtre por "Fonte: BHISS" ao calcular impostos — use somente "ADN Nacional" para evitar duplicatas.</Warn>

      <H2>Exportar para Controle de NF</H2>
      <P>Ao clicar no botão <ArrowUpRight size={12} className="inline text-purple-400" />, um modal permite:</P>
      <ul className="mb-4">
        <Li>Selecionar a <strong className="text-slate-200">Empresa</strong> (pré-preenchida automaticamente quando possível).</Li>
        <Li>Selecionar a <strong className="text-slate-200">Unidade</strong> (filtrada pela empresa selecionada).</Li>
        <Li>Selecionar o <strong className="text-slate-200">Centro de Custo</strong>.</Li>
        <Li>Confirmar a exportação — a NF aparecerá com status <em>Pendente</em> no Controle de NF.</Li>
      </ul>
      <Tip>Use o campo de busca nos selects para localizar rapidamente empresa, unidade ou centro de custo pelo nome.</Tip>

      <H2>Destinatários</H2>
      <P>Cadastre os endereços de e-mail que receberão os documentos fiscais enviados por esta tela.</P>
    </>
  )
}

function SecaoImpostos() {
  return (
    <>
      <H1>Impostos — Calculadora Trimestral</H1>
      <P>Calculadora de tributos trimestrais para empresas no regime de <strong className="text-slate-200">Lucro Presumido</strong>, baseada nas NFS-e emitidas cadastradas no Monitor NFS-e.</P>

      <H2>Como usar</H2>
      <ul className="mb-4">
        <Li>Selecione a <strong className="text-slate-200">empresa</strong>, o <strong className="text-slate-200">ano</strong> e o <strong className="text-slate-200">trimestre</strong> (1T a 4T) no topo.</Li>
        <Li>O faturamento de cada mês é preenchido automaticamente a partir das NFS-e <em>emitidas</em> (fonte ADN) do período.</Li>
        <Li>Edite os valores manualmente se necessário (ex: notas fora do sistema, ajustes).</Li>
        <Li>Os tributos são calculados em tempo real na coluna direita.</Li>
        <Li>Clique em <strong className="text-slate-200">Salvar no Histórico</strong> para registrar o trimestre.</Li>
      </ul>
      <Tip>Ao revisitar um trimestre já salvo, os valores do histórico são carregados automaticamente. Use o botão <strong className="text-slate-200">NFS-e</strong> (<History size={12} className="inline" />) para restaurar os valores originais das notas.</Tip>

      <H2>Tributos Calculados</H2>
      <Table
        headers={['Tributo', 'Base', 'Alíquota padrão']}
        rows={[
          ['IRPJ', 'Faturamento × presunção (32%)', '15% + adicional 10% sobre base > R$60.000'],
          ['CSLL', 'Faturamento × presunção (32%)', '9%'],
          ['PIS', 'Faturamento bruto', '0,65% — apurado (ver nota abaixo)'],
          ['COFINS', 'Faturamento bruto', '3% — apurado (ver nota abaixo)'],
        ]}
      />
      <P><strong className="text-slate-200">Deduções do IRPJ:</strong> IRRF retido pelo tomador (1,5% sobre faturamento) e Adicional IR.</P>
      <P><strong className="text-slate-200">Deduções da CSLL:</strong> CSLL retida pelo tomador (1% sobre faturamento).</P>

      <H2>PIS / COFINS retidos na fonte</H2>
      <P>Para empresas de serviço cujos clientes retêm PIS e COFINS integralmente ao pagar as notas, o sistema exibe o valor <em>apurado</em> de PIS e COFINS, mas o DARF correspondente é R$ 0,00 — pois já foram recolhidos pelo tomador.</P>
      <P>O <strong className="text-slate-200">Total a Recolher (DARF)</strong> exibido é apenas <strong>IRPJ + CSLL</strong>, que são os tributos com guia própria a pagar.</P>
      <Tip>Essa opção vem ativada por padrão. Se sua empresa não tem retenção total de PIS/COFINS, desmarque em <strong className="text-slate-200">Premissas → PIS/COFINS 100% retidos pelo tomador</strong>.</Tip>

      <H2>Premissas</H2>
      <P>Clique em <strong className="text-slate-200">Premissas</strong> (canto superior direito) para configurar as alíquotas da empresa. As premissas são individuais por empresa e persistem entre sessões.</P>
      <Table
        headers={['Campo', 'Padrão', 'Descrição']}
        rows={[
          ['Presunção serviços', '32%', '% da receita considerada como lucro presumido'],
          ['Alíquota IRPJ', '15%', 'Aplicada sobre a base de cálculo'],
          ['Adicional IR', '10%', 'Sobre base que exceder R$60.000 no trimestre'],
          ['Limite adicional', 'R$ 60.000', 'Teto trimestral para o adicional de IR'],
          ['Alíquota CSLL', '9%', 'Aplicada sobre a base de cálculo'],
          ['Alíquota PIS', '0,65%', 'Sobre faturamento bruto'],
          ['Alíquota COFINS', '3%', 'Sobre faturamento bruto'],
          ['IRRF retido', '1,5%', 'Retido pelo tomador — deduzido do IRPJ'],
          ['CSLL retida', '1%', 'Retida pelo tomador — deduzida da CSLL'],
          ['PIS/COFINS retidos', 'Ativado', 'Marca PIS/COFINS como recolhidos pelo tomador'],
        ]}
      />
      <Warn>Altere as alíquotas somente com orientação do seu contador. Os valores padrão correspondem ao regime de Lucro Presumido para prestação de serviços.</Warn>

      <H2>Histórico Trimestral</H2>
      <P>Todos os trimestres salvos aparecem na tabela abaixo da calculadora com IRPJ, CSLL, PIS, COFINS, total e carga efetiva. Use o ícone <Trash2 size={12} className="inline" /> para excluir um registro.</P>
      <Tip>O valor que sua contabilidade emite no DARF pode ser ligeiramente maior que o calculado — a diferença costuma ser multa e juros de mora por pagamento fora do prazo, não erro no cálculo.</Tip>
    </>
  )
}

function SecaoRelatorios() {
  return (
    <>
      <H1>Relatórios de Custo</H1>
      <P>Visualize e analise os custos das Notas Fiscais por período e categoria.</P>

      <H2>Filtros Disponíveis</H2>
      <ul className="mb-4">
        <Li><strong className="text-slate-200">Período</strong> — selecione mês/ano de início e fim.</Li>
        <Li><strong className="text-slate-200">Empresa</strong> — filtra por empresa específica.</Li>
        <Li><strong className="text-slate-200">Unidade</strong> — restringe a uma unidade.</Li>
        <Li><strong className="text-slate-200">Centro de Custo</strong> — agrupa por centro de custo.</Li>
      </ul>

      <H2>Gráficos</H2>
      <P>Os relatórios exibem a evolução dos custos ao longo do tempo e a distribuição por categoria, facilitando a identificação de tendências e anomalias.</P>

      <Tip>Os valores exibidos nos relatórios refletem o campo <em>Valor do Boleto</em> das NFs (valor efetivamente pago/a pagar).</Tip>
    </>
  )
}

function SecaoConfiguracoes() {
  return (
    <>
      <H1>Configurações</H1>
      <P>Gerencie os cadastros base do sistema e as preferências de integração.</P>

      <H2>Empresas</H2>
      <P>Cadastre as empresas do grupo. Campos: razão social, CNPJ, endereço. Empresas são a base para filtrar NFs, unidades e relatórios.</P>

      <H2>Unidades</H2>
      <P>Subdivida cada empresa em unidades (filiais, departamentos, obras). Vinculadas à empresa pai.</P>

      <H2>Centros de Custo</H2>
      <P>Código + descrição para categorização contábil das NFs. Usados nos relatórios de custo.</P>

      <H2>Fornecedores</H2>
      <P>Nome, CNPJ e dados de contato dos fornecedores. O sistema busca automaticamente fornecedores por CNPJ ao importar NFS-e e NF-e — se não existir, cria um novo automaticamente.</P>

      <H2>Funcionários</H2>
      <P>Cadastro de funcionários para uso no módulo de Acerto de Caixa.</P>

      <H2>E-mail / SMTP</H2>
      <P>Configure o servidor de saída de e-mails para uso nas funções de envio de NFs e documentos fiscais.</P>
      <Table
        headers={['Campo', 'Exemplo']}
        rows={[
          ['Host SMTP', 'smtp.gmail.com'],
          ['Porta', '587 (TLS) ou 465 (SSL)'],
          ['Usuário', 'seuconta@gmail.com'],
          ['Senha / App Password', '●●●●●●●●'],
          ['TLS', 'Ativado para porta 587'],
          ['De (nome)', 'Controle NF'],
        ]}
      />
      <Tip>Para Gmail, crie uma <strong>Senha de App</strong> em Conta Google → Segurança → Senhas de App. Não use a senha normal da conta.</Tip>
      <P>Use o botão <strong className="text-slate-200">Testar Envio</strong> para confirmar a configuração antes de salvar.</P>

      <H2>Backup</H2>
      <P>Exporte e importe o banco de dados SQLite completo.</P>
      <ul className="mb-4">
        <Li><Upload size={12} className="inline" /> <strong className="text-slate-200">Exportar Backup</strong> — salva o arquivo <code className="text-xs bg-slate-800 px-1 rounded">database.db</code> em local escolhido.</Li>
        <Li><Download size={12} className="inline" /> <strong className="text-slate-200">Importar Backup</strong> — substitui o banco atual pelo arquivo selecionado.</Li>
      </ul>
      <Warn>Ao importar um backup, os dados atuais são substituídos. Faça um export antes de importar.</Warn>

      <H2>Sequência Inicial de NF</H2>
      <P>Define o número a partir do qual o sequencial de NFs começa quando não há nenhuma NF cadastrada. Útil na migração de sistemas anteriores.</P>

      <H2>Atalhos Globais</H2>
      <Table
        headers={['Ação', 'Como fazer']}
        rows={[
          ['Aumentar zoom', 'Ícone + na barra de título'],
          ['Diminuir zoom', 'Ícone - na barra de título'],
          ['Alternar tema claro/escuro', 'Ícone sol/lua na barra de título'],
        ]}
      />
    </>
  )
}
