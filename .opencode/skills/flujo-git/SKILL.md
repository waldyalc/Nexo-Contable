---
name: flujo-git
description: Convenciones de ramas, commits y seguridad Git en el repositorio público Nexo-Contable.
---

# Skill: Flujo Git

1. Los subagentes trabajan siempre en su propia rama (`feat/*`, `fix/*`) dentro de un worktree aislado.
2. Commits pequeños, claros y en español.
3. **Repositorio público:** verifica con `git status` antes de commitear que no exista ningún `.env*`, token, llave ni archivo dentro de `work/` o `*.sqlite*`.
4. Un subagente nunca hace merge ni push directo a `main` ni usa `--force` o `--no-verify`.
