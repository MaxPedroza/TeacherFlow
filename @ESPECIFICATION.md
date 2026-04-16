# Especificação Técnica: TeacherFlow Web App

## 1. Visão Geral
Sistema de gestão para professores particulares e de escolas, focado em controle de faturamento por aula dada, acompanhamento de alunos e estimativas financeiras em tempo real.

## 2. Stack Tecnológica
- **Frontend:** React.js (Vite) com Hooks e Functional Components.
- **Backend/DB:** Firebase (Firestore + Authentication).
- **Estilização:** SCSS (Sass) com metodologia **BEM** (Block, Element, Modifier).
- **Design:** Mobile First (Bottom Nav) com expansão para Desktop (Sidebar).
- **Tema:** Dark Mode nativo via Custom Properties (CSS Variables).

## 3. Entidades e Estrutura de Dados (Firestore)

### Alunos (`collection: students`)
- `id`: string
- `name`: string
- `origin`: string (Ex: "Particular", "Escola de Música X")
- `rateDefault`: number (Valor base por aula)
- `defaultDuration`: number (30, 45, 60, 90, 120 min)
- `isEffective`: boolean (True: Aluno oficial | False: Aluno em fase de aula demonstrativa)
- `status`: string ('active' | 'inactive')
- `lastLessonDate`: timestamp

### Aulas (`collection: lessons`)
- `id`: string
- `studentId`: string (Ref: students)
- `date`: timestamp
- `duration`: number (Duração em minutos daquela sessão específica)
- `rateApplied`: number (Valor final cobrado pela aula após cálculo de duração/desconto)
- `content`: string (Conteúdo pedagógico ministrado)
- `type`: string ('Normal' | 'Demonstrativa')
- `status`: string ('scheduled' | 'pending' | 'paid')

## 4. Regras de Negócio Fundamentais

### Gestão Financeira
- **Cobrança por Aula:** O faturamento é baseado na soma de aulas dadas, não em mensalidade fixa.
- **Estimativa a Receber:** Soma de todas as aulas com `status: pending`.
- **Saldo Recebido:** Soma das aulas com `status: paid`.
- **Projeção Mensal:** Soma total de (Recebido + Pendente).
- **Filtros de Origem:** Capacidade de visualizar faturamento separado por "Particular" ou por nomes de "Escolas".

### Aulas Demonstrativas
- Aulas demonstrativas sugerem 30 min e possuem `rateApplied` fixo em R$ 0,00.
- Alunos não efetivados (`isEffective: false`) podem ser convertidos para oficial com um clique.

### Ciclo de Vida do Registro
- **Soft Delete:** Alunos inativos são apenas marcados como `status: inactive`, mantendo histórico financeiro.
- **Hard Delete:** Exclusão definitiva permitida para alunos inativos há mais de 6 meses (limpeza de banco), independente de valores pendentes.

## 5. UI/UX e Design System

### Paleta de Cores (Dark Mode Base)
- **Background:** `#0F172A` (Slate 900)
- **Surface:** `#1E293B` (Slate 800)
- **Text Primary:** `#F1F5F9` (Slate 100)
- **Status Pendente/Estimativa:** `#F59E0B` (Amber 500)
- **Status Pago/Sucesso:** `#22C55E` (Emerald 500)
- **Status Agendado/Primário:** `#3B82F6` (Blue 500)
- **Perigo/Exclusão:** `#EF4444` (Red 500)

### Componentização e Estilo
- **Metodologia BEM:** Uso obrigatório de classes como `.stat-card`, `.stat-card__value`, `.stat-card--pending`.
- **Responsividade:** - Mobile: Cards empilhados e navegação inferior.
    - Desktop: Tabela de alunos e navegação lateral fixa.

## 6. Fluxo de Navegação
1. **Dashboard:** Cards de resumo financeiro e lista de aulas do dia para check-in rápido.
2. **Alunos:** CRUD completo, filtros por escola e status de ativação.
3. **Financeiro:** Relatório detalhado de pendências e histórico de pagamentos.
4. **Configurações:** Troca de tema e ferramentas de manutenção (limpeza de inativos).