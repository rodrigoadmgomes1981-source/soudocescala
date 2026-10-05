# Sou DOC · Escalas (protótipo)

Protótipo navegável do fluxo de escalas médicas — React + Vite, pronto para a Vercel.
Os dados ficam no `localStorage` do navegador (não há backend ainda). O botão
**Restaurar dados de demonstração** na barra lateral volta ao estado inicial.

## Fluxo coberto

1. **Contratos (Módulo CR)** — contrato, unidades, setores e tabela de valores
   a faturar/pagar **por hora** em 4 tipos de período (diurno/noturno × dia útil/fim de semana-feriado), com margem.
2. **Criar escala** (assistente em 4 passos)
   - Local: CR → Unidade → Setor
   - Regras: nome, presença (facial e/ou geolocalização, raio, tolerância), base de
     faturamento e de pagamento (planejado / realizado / apurado), passagem e troca
     (automática ou com aprovação, antecedência mínima), anúncio automático de vaga vazia
   - Dias e períodos: dias da semana, início, duração, nº de médicos; valores puxados do CR
   - Vigência: início e fim (opcional)
3. **Grade da escala** — semana a semana; clicar numa vaga para inserir médico e
   escolher **fixo** (repete até o fim da vigência) ou **avulso** (só na data).
   Checa conflito de horário entre todas as escalas e alerta acima de 24h seguidas.
4. **Publicar** — define até quando a escala fica publicada; alterações depois da
   publicação geram aviso e nova versão ao republicar.
5. **Financeiro planejado** — fatura, paga, margem e ocupação por período.
6. **Log de alterações** — cada mudança (regras, períodos, médicos, publicação) com usuário, data/hora e valor anterior → novo.
7. **Vagas anunciadas** — painel com vagas no mural, a anunciar e sem anúncio; preencher direto do painel.
8. **Furos de escala** — furos ocorridos, risco crítico/alto/moderado, taxa de furo e faturamento afetado.

### Novidades da v2
- Períodos com botão **Alterar**, seletor **Diurno / Noturno / 24h / Personalizado** e **salvamento a cada período**
  (o assistente grava o rascunho a cada passo; dá para sair e continuar depois).
- Aviso de sobreposição entre períodos.
- Parâmetros **Pagamento antecipado** (prazo D+n e taxa) e **Pagamento diferenciado antecipado**
  (acréscimo em % ou R$, prazo D+n; aplicado na alocação avulsa de vaga anunciada/furo).
- Navegação sem depender da URL (corrige o travamento ao criar escala na prévia).

### Novidades da v3
- **Unidades**: estado → cidade (5.570 municípios IBGE embutidos), endereço completo, geolocalização (colar coordenadas do Google Maps) e botão **Salvar unidade e setores** (rascunho por unidade).
- **Presença na grade**: horários de check-in/check-out em cada plantão e cores — verde (os dois), amarelo (falta um), vermelho (nenhum), azul (em andamento). Registros simulados.
- **Modal do plantão**: aba Check-in/check-out com fotos (facial) e endereço + distância até a unidade (geolocalização); botão **Acionar pelo chat**.
- **Chat de atendimento** central ⇄ médico, com mensagens prontas por plantão.
- **Travar escala** (Configuração): bloqueia regras, períodos, médicos, publicação e solicitações; só o admin destrava.
- **Apuração em lote** (aba da escala e página Apuração): seleção múltipla, apurar conforme presença, integral, glosar ou reabrir.
- **Filtro por escala** (múltipla escolha) em Furos, Vagas anunciadas e Apuração.
- **Perfis**: Administrador, Escalista, Faturamento, Visualização e Médico (troca em “Acessando como”). Página **Usuários e perfis** para o admin.
- **Médico**: agenda, horas planejadas × executadas, valores (acumulado até hoje e a receber), antecipação de plantões apurados (validação do faturamento), passar/trocar/anunciar plantão conforme a regra da escala.
- **Solicitações** (escalista aprova passagem/troca) e **Antecipações** (faturamento aprova/recusa).

## Rodar local

```bash
npm install
npm run dev
```

## Deploy na Vercel

- Via GitHub: suba a pasta num repositório e importe na Vercel (detecta Vite automaticamente).
- Via CLI: `npx vercel` dentro da pasta (`vercel.json` já configurado).

## Estrutura

```
src/
  lib/utils.js        datas, feriados, tipos de valor, formatação
  lib/escala.js       regras: slots, fixo/avulso, conflitos, resumo financeiro
  lib/seed.js         dados fictícios de demonstração
  lib/store.jsx       estado global + localStorage
  components/         UI e formulários de escala
  pages/              Contratos, Escalas, NovaEscala, EscalaDetalhe, Medicos
```

## Próximos passos sugeridos

Backend (Vercel + Neon Postgres), perfis de acesso, app do médico (check-in, passagem/troca),
integração do anúncio de vaga com o Plantão Match e fechamento da competência
(realizado/apurado).
