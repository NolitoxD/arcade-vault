# CHECKPOINT etapa B — VAULT WORLD CUP · 2026-09-06 (sesión cortada por límite de uso, posible)

Si lees esto tras recargar la sesión: `/retomar tasks/vault-world-cup/CHECKPOINT-etapa-B.md` y sigue
por el primer paso NO marcado. Nada de preguntar a Paco lo ya decidido.

## Hecho en esta sesión (05/06-sep)
- [x] retomar: etapa A commiteada (`c075e87` + `26e09f0`), 760 tests verdes, árbol limpio, sin Kanvas.
- [x] Plan etapa B escrito por subagente: `docs/superpowers/plans/2026-09-05-vault-world-cup-stage-b.md`
      (2911 líneas, Tasks 6a/6b/7, 36 pasos, tabla CARRY al final). SIN commitear (untracked).
- [x] Grill corto con Paco (4 decisiones D1-D4) → volcadas al spec 31 (§portero reglas 2 y 4 +
      §Decisiones, entrada 2026-09-05). Spec modificado SIN commitear.
      D1 K más cercanos persiguen · D2 tackleChance = disposición · D3 perfil humano misma dificultad ·
      D4 REGLA NUEVA portero con balón: atajada ≠ saque de puerta; 2 s inrobable; input del equipo va al
      portero (B = saque con la mano corto asistido, A = largo asistido, cruceta apunta, sin error);
      a los 2 s automático al más libre; CPU siempre automático.
- [ ] Revisión del plan para D4 (agente): sustituir "saque de puerta" por posesión del portero,
      enrutado de TeamInput al portero, tests (a)-(e), etiquetas "Stage B assumption" → "confirmed by
      owner 2026-09-05" para D1-D3, supuesto S-GK. COMPROBAR si ya está: `grep -c "confirmed by owner" plan`.
- [ ] Pre-vuelo con subagente (escaneo de pares de tareas que comparten fichero/interfaz, fixtures
      recalculados), informe en `.superpowers/sdd/2026-09-06-vault-world-cup-stage-b/preflight.md`.
- [ ] `superpowers:subagent-driven-development`: 6a → 6b → 7, cada una con revisión + arreglo + re-revisión.
- [ ] Revisión final de la etapa con sondas ejecutables (scratchpad, NUNCA `*.test.ts` bajo `.superpowers/`).
- [ ] Actualizar memoria `project_arcade_vault_pong_y_plan.md` y handoff.

## Reglas vigentes
Commits SOLO Paco (proponer mensaje). Máximo la etapa B hoy. Duda de diseño → grill corto. Nunca `next dev`.
