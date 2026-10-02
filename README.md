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

## Recherche web et accès local contrôlé

La recherche web utilise DuckDuckGo, sans compte ni clé API. Aucun fournisseur de recherche payant n’est appelé. DuckDuckGo peut toutefois limiter les requêtes ou être temporairement indisponible. Ollama et le modèle téléchargé tournent aussi localement; leur utilisation n’appelle pas d’API de modèle payante.

Le compagnon local donne à G.U.I.D.E accès uniquement au dossier configuré par `LOCAL_AGENT_ROOT`. Par défaut, il utilise le dossier personnel de l’utilisateur (`HOME` / `USERPROFILE`) pour autoriser les fichiers personnels sans toucher au système. Tu peux aussi forcer un chemin absolu vers un dossier précis, par exemple `Documents` ou un dossier de projet. Les dossiers Windows, `AppData`, les secrets et les fichiers système restent bloqués.

Dans un deuxième terminal, lance `npm run agent` et laisse ce processus ouvert; le jeton local est créé automatiquement dans `.local-agent-token`, un fichier ignoré par Git.

G.U.I.D.E peut lire et rechercher dans ce dossier, puis consulter le web. Pour modifier un fichier ou lancer une commande, le chat affiche l’action exacte et attend ta confirmation. Les commandes s’exécutent avec les droits de ton compte Windows et ne sont pas isolées du reste du PC; relis-les attentivement avant de les approuver. Le tableau de bord et le compagnon écoutent uniquement sur `127.0.0.1`.

Pour envoyer directement une commande PowerShell au compagnon, commence le message par `!`, par exemple `! Get-Location` ou `! Get-ChildItem`. La commande exacte sera affichée pour approbation; après exécution, son résultat sera transmis à G.U.I.D.E pour qu’il te l’explique. Un message sans `!` reste une discussion normale avec le modèle.

## Getting Started

Lance le compagnon local dans un terminal, puis le serveur web dans un autre:

```bash
npm run agent
# dans un second terminal
npm run dev
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
