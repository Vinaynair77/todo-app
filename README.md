# To-Do App

A small full-stack to-do application: React + Vite frontend, Express + SQLite backend,
multi-user accounts (email/username + password, or Google sign-in), and personal or shared
team tasks with due dates and completion history.

## Features

- Add tasks with a due date; the owner is the signed-in account
- Complete tasks to move them into the history (with completion timestamps)
- Undo an accidental completion from a toast shown right after marking a task complete
- Overdue highlighting, restore, delete, clear history
- Sign up / sign in with an email address or username, or with Google
- **Personal tasks** stay private to each account
- **Team tasks** can be shared with a named team or with individual accounts
- Create teams with a name, then add or remove members by email/username
- Personal and team tasks appear together in one list; a toggle only chooses what the form creates
- Light and dark themes with a toggle on both the sign-in page and the app

## Light and dark mode

Use the sun/moon button to switch themes. It is available on the sign-in page (top right) and in
the app header next to your account name.

- With no saved choice, the app follows your device's **prefers-color-scheme** setting and updates
  live if that setting changes.
- Clicking the toggle saves your choice in `localStorage` (key `todo-app-theme`), so it persists
  across refreshes, sign-outs, and different accounts on the same browser.
- Form fields, menus, dialogs, badges, and the sign-in page all use the same theme.

## Undoing a completion

When you mark a task complete, a toast appears in the bottom-right with an **Undo** button. It
stays for 7 seconds (a progress bar shows the remaining time) and works for personal and team
tasks alike. Clicking **Undo** restores the task to the open list; the completion timestamp and
"completed by" attribution are cleared, just as with the **Restore** button in History.

- Several completions in a row produce a separate toast for each task, so you can undo any of them.
- **×** dismisses a toast without changing the task; after the timer expires the task stays in
  History, where **Restore** remains available.
- The undo only appears after the server confirms the completion, and it stays visible if a
  restore fails so you can retry.

## Personal and team tasks

Tasks are one of two types:

| Type | Who can see it |
| --- | --- |
| Personal | Only the account that created it |
| Team | The creator plus everyone it is shared with |

A team task is shared either with **a named team** or with **individual people**:

### Named teams

1. Click **Manage teams** next to the **New task** toggle.
2. Create a team with a name (for example `Marketing`) and add members by email/username.
3. When creating a task, switch the toggle to **Team** and pick the team in **Share with → A team**.

Team rules:

- Team names are unique (case-insensitive) and up to 80 characters.
- The creator is always a member and cannot be removed.
- **Any team member** can rename the team, add/remove members, and leave by removing themselves.
- Membership is shared across every task assigned to the team: adding a member gives them access
  to all of that team's tasks, and removing them revokes it.
- Deleting a team keeps its tasks accessible: current team members become direct members of
  each task, and the tasks remain team tasks (now shared with individuals).

### Sharing with individuals

Choose **Share with → Individuals** instead of a team. This is per task: only the accounts you
list can see it. You can switch a task between a team and individual people at any time from its
**Share** button.

Rules for both kinds of sharing:

- Members are added by searching existing accounts (max 8 suggestions); the identifier must
  belong to a registered account. Unknown identifiers are rejected with a message listing them.
- Every member can complete, restore, and delete a shared task.
- History shows who completed a shared task when it was not the creator.
- **Clear history** only deletes completed tasks you created; it never deletes another
  member's shared task.
- Sharing a team task with nobody (no team, no people) leaves it visible only to the creator.

### API endpoints for teams and sharing

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/users/search?q=` | Find accounts by email/username (excludes you) |
| `GET` | `/api/teams` | Teams you created or belong to |
| `POST` | `/api/teams` | Create a team (`name`, `members: []`) |
| `PATCH` | `/api/teams/:id` | Rename a team and/or replace its `members` |
| `DELETE` | `/api/teams/:id` | Delete a team (tasks become directly shared) |
| `POST` | `/api/tasks` | Create a task (`type`, `teamId`, or `members`) |
| `PATCH` | `/api/tasks/:id` | Complete/restore (`completed`), set `teamId`, or set `members` |
| `DELETE` | `/api/tasks/:id` | Delete a task you can see (creator or member) |
| `DELETE` | `/api/tasks/history` | Delete your own completed tasks |

## Requirements

- Node.js 22.9+ (uses the built-in `node:sqlite` module and `--env-file-if-exists`)

## Run it

```bash
npm install
npm run dev
```

`npm run dev` starts both servers:

- Web app: http://localhost:5173
- API: http://localhost:3001 (proxied through Vite at `/api`)

The SQLite database is created automatically at `server/data/app.db`.
Run `npm run build` for a production build.

## Google sign-in setup (optional)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a project
   (or pick an existing one).
2. Under **APIs & Services → OAuth consent screen**, configure the consent screen
   (External, add yourself as a test user while the app is in testing).
3. Under **APIs & Services → Credentials**, click **Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URI: `http://localhost:5173/api/auth/google/callback`
4. Copy `.env.example` to `.env` and fill in the values:

   ```bash
   cp .env.example .env
   ```

   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   APP_URL=http://localhost:5173
   ```

5. Restart `npm run dev`. The **Continue with Google** button appears on the sign-in page.

If the variables are missing, the Google button is hidden and password sign-in keeps working.

### How Google accounts map to users

- A Google sign-in creates an account keyed by the Google email address.
- If an email/username account with the same email already exists, Google is linked to that
  account (Google email verification is required).
- Google-created accounts have no password; they sign in through Google.

## Project layout

```
server/                    Express API
├── index.js               App assembly (port 3001)
├── db.js                  SQLite schema + migrations
├── auth.js                Password hashing, sessions, auth middleware
├── googleAuth.js          Google OAuth helpers
├── members.js             Shared member-identifier resolution
└── routes/
    ├── authRoutes.js      /api/auth/*
    ├── taskRoutes.js      /api/tasks/* (personal + shared team tasks)
    ├── teamRoutes.js      /api/teams/* (named teams and membership)
    └── userRoutes.js      /api/users/search (member lookup)

src/                       React app
├── App.jsx                Auth gate (login page vs. app)
├── api.js                 JSON fetch wrapper
├── auth/AuthContext.jsx   Current user + login/signup/logout
├── hooks/useTasks.js      Task CRUD against the API
├── hooks/useTeams.js      Team CRUD against the API
├── hooks/useTheme.js      Theme state + localStorage persistence
└── components/            AuthPage, TodoApp, TaskForm, TaskList, History,
                           MemberPicker, ShareTaskDialog, TeamsDialog, ThemeToggle
```
