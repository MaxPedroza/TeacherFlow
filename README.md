# TeacherFlow

Aplicação web para gestão de aulas particulares, agenda e acompanhamento financeiro de professores.

## Visão Geral

O TeacherFlow centraliza o dia a dia do professor em uma interface única:

- Cadastro e gestão de alunos
- Agenda com visualização em calendário, semana e lista
- Registro de aulas com status (agendada, pendente, paga)
- Relatório financeiro por período, origem e status
- Alertas no sininho (aulas de hoje, pendências vencidas, elegíveis para exclusão)
- Tema claro/escuro com persistência

## Funcionalidades

### Agenda

- Criação de aulas direto no calendário
- Destaque visual para o dia atual
- Exibição de aluno, horário e instrumento na célula do dia
- Edição e exclusão nas visões semanal e em lista

### Alunos

- Cadastro completo com nome, telefone, origem, instrumento, valor e duração padrão
- Filtros por busca, status, origem e instrumento
- Controle de status (ativo/inativo) e efetivação

### Financeiro

- Visualização de aulas por período
- Filtros por status e origem
- Edição de aulas e atualização de status
- Métricas de recebido, pendente e projeção

### Configurações

- Troca de tema
- Envio de e-mail para redefinição de senha
- Limpeza de alunos inativos elegíveis

## Stack

- React 18
- Vite
- Sass (SCSS)
- Firebase Authentication
- Cloud Firestore
- Firebase Hosting
- lucide-react (ícones)

## Estrutura do Projeto

```txt
src/
  components/
  context/
  hooks/
  pages/
  services/
  styles/
```

## Requisitos

- Node.js 18+
- npm 9+

## Como Rodar Localmente

1. Instale as dependências:

```bash
npm install
```

2. Inicie o ambiente de desenvolvimento:

```bash
npm run dev
```

3. Build de produção:

```bash
npm run build
```

4. Preview local da build:

```bash
npm run preview
```

## Deploy

### Firebase Hosting

Este projeto já está configurado com:

- `firebase.json`
- `.firebaserc`
- scripts de deploy no `package.json`

Comandos:

```bash
npx firebase-tools login
npm run deploy
```

Deploy atual:

- https://teacherflow-db0be.web.app

### CI/CD com GitHub Actions

O projeto possui workflow para deploy automático no Firebase a cada push na branch `main`:

- [deploy-firebase-hosting.yml](.github/workflows/deploy-firebase-hosting.yml)

Para funcionar, adicione este secret no repositório do GitHub:

- Nome: `FIREBASE_SERVICE_ACCOUNT_TEACHERFLOW_DB0BE`
- Valor: JSON da chave de uma Service Account com permissão de deploy no projeto Firebase

Passo a passo rápido para gerar a chave:

1. Acesse Google Cloud Console do projeto `teacherflow-db0be`
2. Vá em `IAM e Admin` > `Service Accounts`
3. Crie (ou use) uma conta de serviço para deploy
4. Em `Keys`, gere uma nova chave `JSON`
5. Copie o conteúdo JSON e cole em `GitHub > Settings > Secrets and variables > Actions`

Depois disso, todo push na `main` dispara build e deploy automático.

## Scripts Disponíveis

- `npm run dev`: desenvolvimento com hot reload
- `npm run build`: build de produção
- `npm run preview`: preview local
- `npm run deploy:build`: build para deploy
- `npm run deploy:hosting`: deploy para Firebase Hosting
- `npm run deploy`: build + deploy

## Status do Projeto

Versão funcional para uso individual (professor), com deploy em produção e base preparada para evolução de permissões e multi-professor.

## Próximos Passos (Roadmap)

- Versionamento de perfis multi-professor
- Controle de papéis (admin/professor)
- Regras avançadas de segurança por instância (tenant)
- Deploy automatizado via GitHub Actions

## Licença

Definir licença do projeto (ex.: MIT) conforme estratégia de publicação.
