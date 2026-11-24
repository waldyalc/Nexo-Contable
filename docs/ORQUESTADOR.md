# docs/ORQUESTADOR.md — Playbook de Orquestación

1. **Una ola a la vez:** lanzar subagentes DeepSeek (`opencode_2` → `opencode-go/deepseek-v4.1-flash`) en worktrees aislados (`isolation: "worktree"`) cuando sus archivos no choquen entre sí.
2. **Brief autosuficiente:** cada subagente recibe objetivos exactos, archivos que posee, contrato SQL/TS que debe respetar, skills que debe leer y comando de verificación (`pnpm typecheck && pnpm check && pnpm test`).
3. **Revisión obligatoria antes de integrar:** revisar `git diff`, confirmar que no haya `any`, selects/fechas nativos, `service_role` en cliente ni archivos privados rastreados.
4. **Integración limpia:** el Orquestador hace merge a `main`, corre la suite completa y luego despacha la siguiente ola.
5. **Regla de candados:** si un subagente comete un error repetible, arreglarlo y agregar un test/candado para que nunca vuelva a pasar.
