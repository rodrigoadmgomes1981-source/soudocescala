// Perfis de acesso e permissões do protótipo
export const PERFIS = [
  { key: 'admin', label: 'Administrador', desc: 'Acesso total: contratos, escalas, usuários, travar/destravar escalas.' },
  { key: 'escalista', label: 'Escalista', desc: 'Cria e edita escalas, aloca médicos, publica, aprova trocas e passagens.' },
  { key: 'faturamento', label: 'Faturamento', desc: 'Apura plantões, valida antecipações e acompanha o financeiro.' },
  { key: 'visualizador', label: 'Visualização', desc: 'Só consulta escalas, check-in/check-out, fotos e localização.' },
  { key: 'medico', label: 'Médico', desc: 'Vê apenas as próprias escalas, agenda, horas, valores e solicitações.' },
]
export const perfilLabel = (k) => PERFIS.find((p) => p.key === k)?.label || k

const P = {
  admin: ['*'],
  escalista: [
    'escalas.ver', 'escalas.editar', 'escalas.alocar', 'escalas.publicar', 'escalas.travar',
    'vagas', 'furos', 'solicitacoes', 'chat', 'presenca.ver', 'contratos.ver', 'medicos', 'financeiro.ver',
  ],
  faturamento: ['escalas.ver', 'apuracao', 'antecipacoes', 'financeiro.ver', 'presenca.ver', 'furos', 'contratos.ver'],
  visualizador: ['escalas.ver', 'presenca.ver'],
  medico: ['medico'],
}

/** can(user, 'escalas.editar') */
export const can = (user, acao) => {
  const lista = P[user?.perfil] || []
  return lista.includes('*') ? acao !== 'medico' : lista.includes(acao)
}
// destravar escala travada: só admin
export const podeDestravar = (user) => user?.perfil === 'admin'
