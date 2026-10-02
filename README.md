This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Configuration Supabase

Le dashboard utilise Supabase pour l’authentification et le stockage des tâches, snippets et conversations.

1. Crée un projet sur [Supabase](https://supabase.com/dashboard).
2. Copie `.env.example` vers `.env.local`, puis renseigne l’URL du projet et sa clé **publishable** depuis les paramètres API.
3. Ouvre le SQL Editor du projet et exécute le contenu de `supabase/schema.sql`. Cela crée les profils, les tables du dashboard et les règles RLS qui isolent les données de chaque compte.
4. Redémarre l’application avec `npm run dev`, puis crée ton compte depuis `/login`.
5. Pour donner le rôle administrateur à ton compte, remplace `REPLACE_WITH_YOUR_ACCOUNT_EMAIL` dans `supabase/promote-admin.sql` par l’adresse utilisée à l’inscription, puis exécute ce script dans le SQL Editor. Le rôle sera visible dans l’en-tête du dashboard.

Supabase Auth conserve les identifiants et les mots de passe. La table `profiles` contient uniquement les informations de profil. N’utilise jamais une clé `service_role` dans le navigateur ou dans `NEXT_PUBLIC_*`.

## Assistant local avec Ollama

Installe Ollama et télécharge le modèle avec `ollama pull llama3.2`. Le service local doit rester lancé pendant l’utilisation du chat. Aucun compte fournisseur ni clé API n’est nécessaire.

L’API vérifie la session Supabase côté serveur, puis transmet au modèle au plus 10 messages récents. Les messages sont limités à 1 500 caractères et la réponse à 512 tokens. Le compteur affiché dans le chat est l’usage local estimé par Ollama, pas une facturation.

Par défaut, l’application contacte Ollama à `http://127.0.0.1:11434`. Si ton serveur Ollama tourne sur une autre adresse, définis `OLLAMA_BASE_URL` dans `.env.local` et redémarre Next.js.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
