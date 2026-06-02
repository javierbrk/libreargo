# CLAUDE.md

Esta guía para Claude Code reutiliza el contenido canónico de `AGENTS.md`
(estándar abierto, compartido con otras herramientas de IA).

@AGENTS.md

---

## Notas específicas de Claude Code

- Antes de dar por terminada una tarea: `npx tsc --noEmit` y `npm test` en verde.
- Mantené el patrón de servicios `mock | http` (ver AGENTS.md, "Reglas de oro").
- Desarrollo usa **mocks**; el HTTP real solo se activa en builds release vía
  `.env.production`. No cambies eso para "probar" — usá un build release.

## ⛔ Regla crítica: NO implementar "Posponer" de alarmas

El **snooze/Posponer de alarmas está fuera del MVP** y fue eliminado a propósito.
**No lo reimplementes** (ni botón, ni `onSnooze`, ni estado `"snoozed"`/
`snoozedUntil`) aunque parezca natural o lo sugiera un test. Alarmas =
**solo Acknowledge**. Detalle en `AGENTS.md` → "Fuera de alcance".
