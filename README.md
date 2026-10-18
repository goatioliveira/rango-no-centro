# 🍛 Rango no Centro

O mapa colaborativo do almoço da galera no Centro do Rio. Cada vez que alguém come num lugar, marca no mapa e deixa uma nota. Com o tempo, o mapa vira o guia particular do grupo.

- **Mapa** com pins coloridos pela média: 🔴 abaixo de 5 · 🟠 5 a 6,9 · 🟡 7 a 8,4 · 🟢 8,5 ou mais · ⚪ ainda sem avaliação
- **Avaliações** com nota geral (0 a 10, de meio em meio ponto), notas de comida, atendimento e custo-benefício, preço pago, o que pediu, prós, contras, "voltaria?" e até 3 fotos
- A média de cada lugar usa só a **avaliação mais recente de cada pessoa** (quem vai toda semana não pesa mais que os outros)
- **Adicionar restaurante** buscando pelo nome ou endereço (OpenStreetMap), **colando o link do Google Maps** (Compartilhar → Copiar link), mirando no mapa, segurando o dedo no lugar ou com "estou aqui"
- **Lista** com busca, filtros (categorias, preço, nota mínima, "ainda não fui", "quero ir") e ordenação (melhor nota, mais avaliados, mais barato, mais recente, mais perto)
- **Tempo real**: quando alguém marca ou avalia um lugar, aparece pra todo mundo na hora
- **Grupo**: ranking de quem mais desbrava o Centro e as últimas atividades
- 🎲 **Sorteia um almoço**: sorteia um lugar com nota 7+ dentro dos filtros atuais
- **Exportar tudo em CSV** (abre no Excel ou no Google Planilhas)
- **Instalável no celular** (PWA) e com modo escuro automático

O acesso é **fechado**: entra com a conta Google e, na primeira vez, digita o **código de convite** do grupo.

---

## Como funciona por dentro

| Parte | Tecnologia | Custo |
|---|---|---|
| Site | Next.js 16 + TypeScript + Tailwind CSS | grátis |
| Banco, login, tempo real e fotos | Supabase (Postgres + Auth + Realtime + Storage) | plano grátis |
| Mapa | Leaflet + OpenStreetMap | grátis, sem chave |
| Busca de endereço | Photon (autocompletar) e Nominatim (botão "Buscar") | grátis, sem chave |
| Hospedagem | Vercel | plano grátis |

**Segurança.** Todas as regras de acesso ficam no banco (Row Level Security):

- Quem não digitou o código não vê nada.
- Cada pessoa só edita e apaga as próprias avaliações.
- O admin pode apagar qualquer coisa.
- O código de convite fica numa tabela que o navegador não consegue ler. Ele é conferido por uma função do banco (`join_group`).
- O app só usa a chave **pública** do Supabase. A chave secreta (service role) nunca é usada.

```
supabase/migrations/   → o banco inteiro (tabelas, regras de acesso, funções)
supabase/tests/        → testes das regras de acesso
src/app/               → páginas (entrar, mapa, lista, grupo, eu)
src/components/        → telas e componentes
src/lib/               → funções auxiliares (cores, busca, fotos, CSV)
src/proxy.ts           → renova o login a cada acesso e manda quem não entrou para /entrar
```

---

## Colocar no ar (passo a passo)

São 4 etapas: **Supabase → Google → Vercel → ajustes finais**. Tudo pelo navegador, sem instalar nada.

### 1. Criar o projeto no Supabase

1. Acesse <https://supabase.com> e clique em **Start your project**. Entre com sua conta do GitHub.
2. Clique em **New project**.
   - **Name:** `rango-no-centro`
   - **Database Password:** clique em **Generate a password** e guarde num lugar seguro (quase nunca vai precisar).
   - **Region:** `South America (São Paulo)`
   - Clique em **Create new project** e espere uns 2 minutos.
3. No menu da esquerda, abra **SQL Editor** (ícone `>_`).
4. Clique em **+ New query**. Abra o arquivo [`supabase/migrations/20261018000001_schema.sql`](supabase/migrations/20261018000001_schema.sql) aqui no GitHub, clique no botão de **copiar** (ícone de dois quadradinhos, em cima à direita do arquivo), cole no editor e clique em **Run**. Deve aparecer `Success. No rows returned`.
5. Faça o mesmo com o arquivo [`supabase/migrations/20261018000002_photos.sql`](supabase/migrations/20261018000002_photos.sql): **+ New query** → colar → **Run**.
6. Anote dois valores (vão ser usados na Vercel):
   - Clique em **Project Settings** (engrenagem) → **Data API** e copie a **Project URL** (algo como `https://abcdefgh.supabase.co`).
   - Em **Project Settings** → **API Keys**, copie a **Publishable key** (começa com `sb_publishable_...`). Se só aparecer a aba "Legacy", copie a chave **anon public**.
   - ⚠️ **Não** use a chave `secret` / `service_role`.

### 2. Configurar o login com Google

1. Acesse <https://console.cloud.google.com> com sua conta Google.
2. No topo, clique no seletor de projetos → **New project** → nome `Rango no Centro` → **Create**. Confira se o projeto novo está selecionado no topo.
3. No menu (☰), vá em **APIs & Services** → **OAuth consent screen** (ou **Google Auth Platform**) e clique em **Get started**.
   - **App name:** `Rango no Centro` · **User support email:** seu e-mail → **Next**
   - **Audience:** `External` → **Next**
   - **Contact information:** seu e-mail → **Next**
   - Aceite os termos → **Continue** → **Create**
4. Vá em **Clients** → **+ Create client**.
   - **Application type:** `Web application` · **Name:** `Rango Supabase`
   - Em **Authorized redirect URIs**, clique em **+ Add URI** e cole a URL do seu Supabase com `/auth/v1/callback` no final:
     `https://SEU-PROJETO.supabase.co/auth/v1/callback`
   - Clique em **Create**. Copie o **Client ID** e o **Client secret** que aparecem.
5. Vá em **Audience** e clique em **Publish app** → **Confirm**. Sem isso, só e-mails cadastrados como "test users" conseguem entrar. Como o app só pede nome, e-mail e foto, o Google não exige revisão.
6. Volte ao **Supabase** → **Authentication** → **Sign In / Providers** (ou **Providers**) → **Google**:
   - Ligue **Enable Sign in with Google**.
   - Cole o **Client ID** e o **Client Secret** → **Save**.

### 3. Publicar na Vercel

1. Acesse <https://vercel.com> e entre com o GitHub.
2. **Add New…** → **Project** → escolha o repositório `rango-no-centro` → **Import**.
3. Abra **Environment Variables** e adicione:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | a Project URL do passo 1.6 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | a Publishable key do passo 1.6 |

4. Clique em **Deploy** e espere uns 2 minutos. Copie o endereço do site (algo como `https://rango-no-centro.vercel.app`).

> A Vercel publica o branch principal (`main`). Se o código estiver em outro branch, junte com o `main` antes (pelo pull request no GitHub).

### 4. Ajustes finais no Supabase

1. **Authentication** → **URL Configuration**:
   - **Site URL:** o endereço da Vercel (ex.: `https://rango-no-centro.vercel.app`)
   - Em **Redirect URLs**, clique em **Add URL** e adicione:
     - `https://rango-no-centro.vercel.app/**` (o seu endereço com `/**` no final)
     - `http://localhost:3000/**` (só se for rodar no computador)
   - **Save**.
2. Abra o site no celular, entre com o Google e digite o código **`primeiro-rango`**.
   **A primeira pessoa a entrar vira admin.** Vá logo na aba **Eu** → **Área do admin** e troque o código.

### Instalar no celular

- **iPhone (Safari):** abra o site → botão **Compartilhar** → **Adicionar à Tela de Início**.
- **Android (Chrome):** abra o site → menu **⋮** → **Instalar app** (ou **Adicionar à tela inicial**).

---

## Convidar, remover e trocar o código

Tudo na aba **Eu** → **Área do admin** (só aparece para admins):

- **Convidar alguém:** toque em **Convidar alguém**. O app monta uma mensagem com o link e o código, pronta pra mandar no grupo do zap. A pessoa entra com o Google, digita o código uma vez e escolhe o apelido.
- **Trocar o código:** digite o novo código e toque na chave 🔑. Quem já está no grupo continua normalmente. O código antigo para de funcionar.
- **Remover alguém:** toque no ícone de pessoa com "−". A pessoa perde o acesso na hora e não consegue voltar nem com o código. As avaliações dela continuam no mapa.
- **Desbloquear:** a pessoa aparece em **Bloqueados**. Toque em **Desbloquear** e ela pode entrar de novo com o código atual. Quem erra o código 10 vezes também cai nessa lista.
- **Tornar admin / tirar admin:** ícone do escudo ao lado de cada membro.

Se precisar mexer direto no banco (por exemplo, se você perder o acesso de admin), use o **SQL Editor** do Supabase:

```sql
-- ver o código atual
select invite_code from app_config;

-- trocar o código
update app_config set invite_code = 'novo-codigo-secreto';

-- tornar alguém admin (troque pelo e-mail da pessoa)
update profiles set is_admin = true, is_member = true, is_blocked = false
where id = (select id from auth.users where email = 'fulano@gmail.com');
```

---

## Rodar no computador (para quem for mexer no código)

Precisa de [Node.js 20+](https://nodejs.org).

```bash
npm install
cp .env.example .env.local     # e preencha com a URL e a chave pública do Supabase
npm run dev                    # abre em http://localhost:3000
```

Lembre de adicionar `http://localhost:3000/**` nas **Redirect URLs** do Supabase (passo 4.1).

Comandos úteis:

| Comando | O que faz |
|---|---|
| `npm run dev` | roda o app em modo desenvolvimento |
| `npm run build` | gera a versão de produção (o mesmo que a Vercel faz) |
| `npm run lint` | procura problemas no código |
| `npm run test:rls` | testa as regras de acesso do banco num Postgres local (precisa do Postgres instalado) |
| `node scripts/gerar-icones.mjs` | regenera os ícones do app |

### Mudanças no banco

Cada mudança no banco vira um arquivo novo em `supabase/migrations/` (nunca edite um que já foi aplicado). Para aplicar, cole no **SQL Editor** do Supabase. Quem usa a [Supabase CLI](https://supabase.com/docs/guides/cli) pode rodar `supabase db push`.

---

## Limites do plano grátis (pra ninguém se assustar)

- **Supabase:** 500 MB de banco e 1 GB de fotos. Dá e sobra para um grupo de amigos. Se o projeto ficar **7 dias sem nenhum acesso**, o Supabase pausa. Para reativar, é só entrar no painel e clicar em **Restore project**, sem perder nada.
- **Vercel:** sobra para esse uso.
- **Mapas e busca:** o OpenStreetMap é mantido por voluntários. O app respeita as regras de uso: a busca automática usa o Photon, e o Nominatim só é chamado quando você toca em **Buscar**.
