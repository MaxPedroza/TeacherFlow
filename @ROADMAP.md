# TeacherFlow — Roadmap SaaS

> Documento vivo. Atualizar sempre que uma tarefa for concluída ou uma nova for identificada.
> Legenda: ✅ Concluído | 🔄 Em progresso | ⏳ Pendente | 🚫 Bloqueado
> Última atualização: maio/2026

---

## Estado Atual do Projeto (maio/2026)

### Stack
- **Frontend:** React 18 + Vite, SCSS/BEM, mobile-first
- **Backend:** Firebase (Auth, Firestore, Hosting, Cloud Functions v2)
- **IA:** Google Gemini 2.0 Flash via Cloud Function (`aiChat`)
- **Deploy:** GitHub Actions (hosting) + Firebase CLI (functions)
- **Projeto Firebase:** `teacherflow-db0be` | Região: `us-central1`

---

## Fase 1 — MVP (produto funcional para uso próprio)

### Autenticação
- ✅ Login com Google (Firebase Auth)
- ✅ Proteção de rotas (redirect para /login se não autenticado)
- ✅ Contexto de usuário global (`AuthContext`)

### Alunos
- ✅ CRUD completo (criar, editar, visualizar, inativar)
- ✅ Filtros por instrumento, origem e status
- ✅ Soft delete (status: inactive) + hard delete após 6 meses sem aula
- ✅ Campo `isEffective` (aluno oficial vs. demonstrativo)
- ✅ Isolamento por professor via `teacherId` no Firestore
- ✅ Estado vazio com CTA para cadastrar primeiro aluno

### Aulas
- ✅ CRUD completo (criar, editar, cancelar, deletar)
- ✅ Status: `scheduled`, `pending`, `paid`, `canceled_in_time`, `no_show`
- ✅ Campos: data, duração, valor aplicado, conteúdo, tipo (Normal/Demonstrativa)
- ✅ Aula demonstrativa: duração 30 min, valor R$ 0,00
- ✅ Isolamento por professor via `teacherId` no Firestore
- ✅ Sincronização de `lastLessonDate` no aluno ao criar/editar aula

### Dashboard
- ✅ Cards de resumo: alunos ativos, aulas hoje, receita pendente, projeção mensal
- ✅ Lista de aulas do dia com ações rápidas de status
- ✅ Aviso quando não há alunos cadastrados

### Agenda
- ✅ Visualização por mês (calendário), semana e lista
- ✅ Criação de aula ao clicar em dia vazio
- ✅ Modal de detalhes ao clicar em dia com aulas (cards com editar/deletar)
- ✅ Aviso quando não há alunos cadastrados

### Financeiro
- ✅ Filtros por período (hoje, semana, mês, mês anterior, mês específico, trimestre, semestre, ano, tudo)
- ✅ Filtros por status, categoria (escola/particular), origem e aluno
- ✅ Cards de resumo: recebido, pendente, projeção
- ✅ Tabela de aulas com edição inline de status
- ✅ Aviso quando não há alunos cadastrados

### Configurações
- ✅ Toggle dark/light mode
- ✅ Envio de e-mail para redefinição de senha
- ✅ Ferramenta de limpeza de alunos inativos há +6 meses

### IA (TeacherAI)
- ✅ Assistente via Cloud Function + Gemini 2.0 Flash
- ✅ Contexto do professor injetado (alunos, aulas recentes, financeiro)
- ✅ Intenções estruturadas (criar aluno, criar aula, atualizar status, cancelar)
- ✅ Limite diário de 50 mensagens por usuário
- ✅ Tratamento de erros (quota, key inválida, model not found)

### Infra
- ✅ Hospedagem no Firebase Hosting
- ✅ Deploy automático via GitHub Actions (hosting only)
- ✅ Cloud Functions v2 com Secret Manager (GEMINI_API_KEY)
- ✅ Multi-tenancy via `teacherId` (isolamento de dados por professor)

---

## Fase 2 — Hardening (produto seguro para outros usuários)

### Segurança
- ✅ **Firestore Security Rules** — `firestore.rules` criado e deployado; garante `teacherId == request.auth.uid` em `students` e `lessons`
- ✅ **Multi-tenancy** — isolamento de dados por professor via `teacherId` em todas as queries
- ⏳ **Validação de inputs nas Cloud Functions** — sanitizar dados antes de gravar no Firestore

### Qualidade
- ✅ Toast global (`ToastContext`) — feedback consistente em todas as páginas, substituindo estados locais
- ✅ `ConfirmDialog` reutilizável — confirmação antes de excluir aluno ou limpar inativos
- ✅ Onboarding — tela de boas-vindas no Dashboard para professor sem nenhum aluno/aula
- ✅ Empty states — aviso com CTA para /alunos em Agenda, Financeiro e Dashboard
- ✅ Checklist de primeiros passos (`OnboardingChecklist`) — widget no Dashboard com 4 passos derivados de dados reais; desaparece ao concluir tudo
- ✅ Tooltips contextuais (`HelpTooltip`) — ícone `?` nos campos complexos de LessonForm e StudentForm
- ⏳ Loading states em operações assíncronas (criação, edição, deleção)

---

## Fase 3 — Monetização (SaaS com planos)

### Planos
- ⏳ Definir planos (ex: Free / Pro):
  - **Free:** até 5 alunos ativos, sem IA, sem relatórios avançados
  - **Pro:** ilimitado, IA inclusa, relatórios completos, exportação

### Infraestrutura de Planos
- ⏳ Campo `plan` no documento do usuário no Firestore (`free` | `pro`)
- ⏳ Campo `planExpiresAt` (timestamp) para controle de vencimento
- ⏳ Cloud Function para verificar plano antes de liberar features premium
- ⏳ Firestore Security Rules atualizadas para bloquear features premium para usuários free

### Gateway de Pagamento
- ⏳ Escolher gateway: **Stripe** (internacional) ou **Pagar.me / Mercado Pago** (Brasil)
- ⏳ Integrar webhook de pagamento confirmado → atualizar `plan` no Firestore
- ⏳ Página de planos e checkout dentro do app
- ⏳ Página de gerenciamento de assinatura (cancelar, ver próxima cobrança)

### Limites por Plano no Frontend
- ⏳ Bloquear cadastro de aluno quando free atingir limite (ex: 5)
- ⏳ Bloquear acesso à IA para plano free
- ⏳ UI de "upgrade" ao tentar usar feature premium

---

## Fase 4 — Aquisição (crescimento de usuários)

### Landing Page
- ⏳ Página pública em `/` (fora do app) com:
  - Proposta de valor clara
  - Print/demo do produto
  - Seção de planos e preços
  - CTA de cadastro
- ⏳ Separar rota `/app` para o produto logado vs. `/` para a landing

### SEO e Analytics
- ⏳ Meta tags (título, descrição, OG tags) na landing page
- ⏳ Google Analytics ou Plausible para medir conversão

### Legal (obrigatório para cobrar)
- ⏳ Página de Termos de Uso
- ⏳ Política de Privacidade (LGPD)
- ⏳ Aceite dos termos no primeiro login

---

## Fase 5 — Expansão de Features

### Relatórios
- ⏳ Exportação de relatório financeiro em PDF ou CSV
- ⏳ Gráfico de evolução de receita mês a mês

### Comunicação
- ⏳ Notificações por e-mail (lembrete de aulas do dia, resumo semanal)
- ⏳ WhatsApp link direto para aluno a partir do cadastro

### Agenda
- ⏳ Recorrência de aulas (ex: toda segunda às 14h)
- ⏳ Exportação de aula para Google Calendar (funcionalidade premium)

### Alunos
- ⏳ Campo de instrumento livre (além da lista fixa)
- ⏳ Histórico de progresso / anotações pedagógicas por aluno
- ⏳ Foto do aluno

---

## Débitos Técnicos Conhecidos

| Item | Impacto | Prioridade |
|---|---|---|
| Node.js 20 nas Functions (depreca out/2026) | Médio — infra | 🟡 Médio prazo |
| firebase-functions v4.9.0 desatualizado | Baixo — warnings | 🟢 Baixa |
| Gemini quota (plano gratuito esgota rápido) | Médio — IA | 🟡 Médio prazo |
| Validação de inputs nas Cloud Functions | Médio — segurança | 🟡 Médio prazo |

---

## Próxima Ação Recomendada

**Fase 3 — Monetização:** a base técnica está sólida. Próximo passo é definir os planos (Free/Pro), criar o campo `plan` no Firestore e integrar um gateway de pagamento.
