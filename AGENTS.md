<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md - System Rules for AI Tools

## 1. Git Workflow Constraints

- You must work exclusively within your assigned task branch. Never attempt to push directly to `main` or `master`.
- Do not attempt to use `git worktree` commands; your runtime environment is already isolated.
- Before writing any code, verify your active branch using `git branch --show-current`.

## 2. Sync & Commits

- Run `git pull origin <your-branch-name>` before editing any files.
- Make small, atomic commits using the Conventional Commits specification (e.g., `feat(ui): add button`, `fix(api): fix timeout`).

## 3. Conflict Handling

- If you encounter a Git merge conflict that fails automated tests, STOP immediately.
- Do not guess or blindly overwrite code blocks. Present the conflict markers to the human.
