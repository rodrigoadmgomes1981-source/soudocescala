// Dados fictícios para demonstração
const v = (du, nu, df, nf) => ({
  diu_util: du,
  not_util: nu,
  diu_fds: df,
  not_fds: nf,
})

const base = () => ({
  versao: 3,
  contratos: [
    {
      id: 'cr1',
      codigo: 'CR 1042',
      cliente: 'Unimed Litoral (fictício)',
      objeto: 'Gestão do Pronto Atendimento e cobertura de Neurologia',
      vigenciaInicio: '2026-09-01',
      vigenciaFim: '2027-08-31',
      unidades: [
        {
          id: 'u1',
          nome: 'Pronto Atendimento Central',
          uf: 'SC',
          cidade: 'Itajaí',
          endereco: { cep: '88301-000', logradouro: 'Rua das Palmeiras', numero: '1200', complemento: 'Bloco A', bairro: 'Centro' },
          geo: { lat: -26.9078, lng: -48.6619 },
          setores: [
            {
              id: 's1',
              nome: 'Clínica Médica',
              valores: v(
                { fat: 165, pag: 125 },
                { fat: 185, pag: 140 },
                { fat: 195, pag: 150 },
                { fat: 210, pag: 160 },
              ),
            },
            {
              id: 's2',
              nome: 'Pediatria',
              valores: v(
                { fat: 180, pag: 135 },
                { fat: 200, pag: 150 },
                { fat: 210, pag: 160 },
                { fat: 230, pag: 175 },
              ),
            },
          ],
        },
        {
          id: 'u2',
          nome: 'Hospital Unimed',
          uf: 'SC',
          cidade: 'Balneário Camboriú',
          endereco: { cep: '88330-000', logradouro: 'Avenida das Nações', numero: '2500', complemento: '', bairro: 'Centro' },
          geo: { lat: -26.9906, lng: -48.6348 },
          setores: [
            {
              id: 's3',
              nome: 'Neurologia (sobreaviso presencial)',
              valores: v(
                { fat: 260, pag: 200 },
                { fat: 290, pag: 220 },
                { fat: 300, pag: 230 },
                { fat: 320, pag: 245 },
              ),
            },
          ],
        },
      ],
    },
    {
      id: 'cr2',
      codigo: 'CR 1057',
      cliente: 'Hospital São Lucas (fictício)',
      objeto: 'Cobertura de Emergência adulto',
      vigenciaInicio: '2026-10-01',
      vigenciaFim: '2027-09-30',
      unidades: [
        {
          id: 'u3',
          nome: 'Emergência Adulto',
          uf: 'SC',
          cidade: 'Joinville',
          endereco: { cep: '89201-000', logradouro: 'Rua dos Imigrantes', numero: '800', complemento: '', bairro: 'América' },
          geo: { lat: -26.3045, lng: -48.8487 },
          setores: [
            {
              id: 's4',
              nome: 'Sala Vermelha',
              valores: v(
                { fat: 190, pag: 145 },
                { fat: 210, pag: 160 },
                { fat: 220, pag: 170 },
                { fat: 240, pag: 185 },
              ),
            },
          ],
        },
      ],
    },
  ],
  medicos: [
    { id: 'm1', nome: 'Ana Beatriz Moura', crm: 'CRM/SC 21345', especialidade: 'Clínica Médica' },
    { id: 'm2', nome: 'Bruno Carvalho', crm: 'CRM/SC 19876', especialidade: 'Clínica Médica' },
    { id: 'm3', nome: 'Camila Teixeira', crm: 'CRM/SC 24510', especialidade: 'Medicina de Emergência' },
    { id: 'm4', nome: 'Diego Fontana', crm: 'CRM/SC 18220', especialidade: 'Clínica Médica' },
    { id: 'm5', nome: 'Elisa Ramos', crm: 'CRM/SC 27801', especialidade: 'Pediatria' },
    { id: 'm6', nome: 'Felipe Andrade', crm: 'CRM/SC 22904', especialidade: 'Pediatria' },
    { id: 'm7', nome: 'Gabriela Nunes', crm: 'CRM/SC 16533', especialidade: 'Neurologia' },
    { id: 'm8', nome: 'Henrique Vidal', crm: 'CRM/SC 20117', especialidade: 'Neurologia' },
    { id: 'm9', nome: 'Isabela Prado', crm: 'CRM/SC 25678', especialidade: 'Medicina de Emergência' },
    { id: 'm10', nome: 'João Pedro Lins', crm: 'CRM/SC 23419', especialidade: 'Clínica Médica' },
  ],
  escalas: [
    {
      id: 'e1',
      crId: 'cr1',
      unidadeId: 'u1',
      setorId: 's1',
      nome: 'PA Central · Clínica Médica',
      presenca: ['facial', 'geo'],
      raioGeo: 200,
      toleranciaMin: 15,
      faturamento: 'apurado',
      pagamento: 'realizado',
      passagem: 'aprovacao',
      troca: 'automatica',
      antecedenciaHoras: 24,
      anunciarVaga: true,
      anuncioHorasAntes: 72,
      vigenciaInicio: '2026-09-01',
      vigenciaFim: '',
      publicadaAte: '2026-10-31',
      travada: false,
      status: 'publicada',
      versao: 2,
      pagAntecipado: { ativo: true, prazoDias: 5, taxa: 2.5 },
      pagDiferenciado: { ativo: true, tipo: 'percentual', valor: 20, prazoDias: 2 },
      historico: [
        { em: '2026-09-25T10:12:00', usuario: 'Rodrigo Gomes', tipo: 'regra', acao: 'Escala criada' },
        { em: '2026-09-25T10:20:00', usuario: 'Rodrigo Gomes', tipo: 'periodo', acao: 'Período adicionado: Todos os dias · 07:00–19:00 (12h) · 2 médicos' },
        { em: '2026-09-25T10:22:00', usuario: 'Rodrigo Gomes', tipo: 'periodo', acao: 'Período adicionado: Todos os dias · 19:00–07:00 (12h) · 2 médicos' },
        { em: '2026-09-28T16:40:00', usuario: 'Rodrigo Gomes', tipo: 'publicacao', acao: 'Publicada até 31/10/2026 (v1)' },
        { em: '2026-10-02T09:05:00', usuario: 'Coord. Clínica Médica', tipo: 'regra', acao: 'Regras alteradas', detalhes: [{ campo: 'Base de faturamento', de: 'Realizado', para: 'Apurado' }] },
        { em: '2026-10-02T09:06:00', usuario: 'Coord. Clínica Médica', tipo: 'publicacao', acao: 'Republicada até 31/10/2026 (v2)' },
      ],
      turnos: [
        { id: 't1', inicio: '07:00', duracao: 12, vagas: 2, dias: [0, 1, 2, 3, 4, 5, 6] },
        { id: 't2', inicio: '19:00', duracao: 12, vagas: 2, dias: [0, 1, 2, 3, 4, 5, 6] },
      ],
      alocacoes: [
        { id: 'a1', turnoId: 't1', vagaIdx: 0, medicoId: 'm1', fixo: true, desde: '2026-09-01' },
        { id: 'a2', turnoId: 't1', vagaIdx: 1, medicoId: 'm2', fixo: true, desde: '2026-09-01' },
        { id: 'a3', turnoId: 't2', vagaIdx: 0, medicoId: 'm4', fixo: true, desde: '2026-09-01' },
        { id: 'a3b', turnoId: 't2', vagaIdx: 1, medicoId: 'm10', fixo: true, desde: '2026-09-01', ate: '2026-10-03' },
        { id: 'a4', turnoId: 't2', vagaIdx: 1, medicoId: 'm10', fixo: false, data: '2026-10-05' },
        { id: 'a5', turnoId: 't2', vagaIdx: 1, medicoId: 'm3', fixo: false, data: '2026-10-06', diferenciado: true },
        { id: 'a6', turnoId: 't1', vagaIdx: 1, medicoId: null, fixo: false, data: '2026-10-07' },
      ],
    },
    {
      id: 'e2',
      crId: 'cr1',
      unidadeId: 'u2',
      setorId: 's3',
      nome: 'Neuro · Hospital Unimed',
      presenca: ['geo'],
      raioGeo: 300,
      toleranciaMin: 10,
      faturamento: 'planejado',
      pagamento: 'apurado',
      passagem: 'aprovacao',
      troca: 'aprovacao',
      antecedenciaHoras: 48,
      anunciarVaga: false,
      anuncioHorasAntes: 48,
      vigenciaInicio: '2026-10-05',
      vigenciaFim: '2027-08-31',
      publicadaAte: '',
      travada: false,
      status: 'rascunho',
      versao: 1,
      pagAntecipado: { ativo: false, prazoDias: 5, taxa: 0 },
      pagDiferenciado: { ativo: false, tipo: 'valor', valor: 300, prazoDias: 2 },
      historico: [{ em: '2026-10-03T14:20:00', usuario: 'Rodrigo Gomes', tipo: 'regra', acao: 'Escala criada' }],
      turnos: [
        { id: 't3', inicio: '07:00', duracao: 24, vagas: 1, dias: [1, 3, 5] },
        { id: 't4', inicio: '07:00', duracao: 24, vagas: 1, dias: [0, 2, 4, 6] },
      ],
      alocacoes: [
        { id: 'a7', turnoId: 't3', vagaIdx: 0, medicoId: 'm7', fixo: true, desde: '2026-10-05' },
      ],
    },
  ],
})

import { findSetor, slotsDoDia } from './escala'
import { presencaDe, sugestaoApuracao, apKey } from './presenca'
import { addDays } from './utils'

export const seed = () => {
  const db = base()
  db.usuarios = [
    { id: 'u_admin', nome: 'Rodrigo Gomes', email: 'rodrigo.gomes@doccsc.com.br', perfil: 'admin', ativo: true },
    { id: 'u_esc', nome: 'Marina Lopes', email: 'marina.lopes@exemplo.com', perfil: 'escalista', ativo: true },
    { id: 'u_fat', nome: 'Carlos Menezes', email: 'carlos.menezes@exemplo.com', perfil: 'faturamento', ativo: true },
    { id: 'u_vis', nome: 'Diretoria Técnica', email: 'diretoria@exemplo.com', perfil: 'visualizador', ativo: true },
    { id: 'u_m1', nome: 'Ana Beatriz Moura', email: 'ana.moura@exemplo.com', perfil: 'medico', medicoId: 'm1', ativo: true },
    { id: 'u_m4', nome: 'Diego Fontana', email: 'diego.fontana@exemplo.com', perfil: 'medico', medicoId: 'm4', ativo: true },
    { id: 'u_m3', nome: 'Camila Teixeira', email: 'camila.teixeira@exemplo.com', perfil: 'medico', medicoId: 'm3', ativo: true },
  ]
  db.usuarioAtual = 'u_admin'

  // Setembro já apurado na escala do PA Central
  db.apuracoes = {}
  const e1 = db.escalas.find((e) => e.id === 'e1')
  const { unidade, setor } = findSetor(db, e1.crId, e1.unidadeId, e1.setorId)
  for (let d = '2026-09-01'; d <= '2026-09-30'; d = addDays(d, 1)) {
    for (const s of slotsDoDia(e1, setor.valores, d)) {
      if (!s.medicoId) continue
      const sug = sugestaoApuracao(s, presencaDe(e1, s, unidade, ''))
      if (!sug) continue
      db.apuracoes[apKey(e1.id, s.key)] = {
        status: sug.glosa ? 'glosado' : 'apurado',
        horas: sug.horas,
        pag: sug.glosa ? 0 : sug.pag,
        fat: sug.glosa ? 0 : sug.fat,
        medicoId: s.medicoId,
        por: 'Carlos Menezes',
        em: '2026-10-02T10:00:00',
      }
    }
  }

  // Antecipação pendente da Dra. Ana Beatriz (3 plantões apurados de setembro)
  const itens = Object.entries(db.apuracoes)
    .filter(([k, a]) => a.medicoId === 'm1' && a.status === 'apurado' && k.includes('2026-09-2'))
    .slice(0, 3)
  const bruto = itens.reduce((t, [, a]) => t + a.pag, 0)
  db.antecipacoes = [
    {
      id: 'ant1',
      medicoId: 'm1',
      itens: itens.map(([k]) => k),
      bruto,
      taxa: e1.pagAntecipado.taxa,
      liquido: Math.round(bruto * (1 - e1.pagAntecipado.taxa / 100) * 100) / 100,
      status: 'pendente',
      criadoEm: '2026-10-04T18:30:00',
    },
  ]

  db.solicitacoes = [
    {
      id: 'sol1',
      tipo: 'passagem',
      escalaId: 'e1',
      turnoId: 't2',
      vagaIdx: 0,
      data: '2026-10-09',
      medicoId: 'm4',
      destinoId: 'm10',
      motivo: 'Compromisso familiar',
      status: 'pendente',
      criadoEm: '2026-10-05T08:12:00',
    },
  ]

  db.chats = {
    m1: [
      { de: 'central', autor: 'Marina Lopes', texto: 'Dra. Ana, confirmando seu plantão de amanhã às 07:00 no PA Central.', em: '2026-10-04T17:02:00' },
      { de: 'medico', autor: 'Ana Beatriz Moura', texto: 'Confirmado, estarei lá.', em: '2026-10-04T17:10:00' },
    ],
  }
  return db
}
