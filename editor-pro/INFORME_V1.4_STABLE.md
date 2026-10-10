# Informe de estabilización — Novel Forge 404 v1.4.0

## Decisión técnica

Se ha utilizado la v1.3.0 como base porque es la versión comprobada por el usuario y utiliza un arranque clásico, directo y tolerante. No se ha reutilizado la rama v2, cuyos módulos podían impedir la inicialización completa y dejar todos los controles inactivos.

## Problemas corregidos

### Alto — selección perdida en la barra editorial

Al pulsar un botón, el foco podía abandonar el editor antes de ejecutar la orden. Se guarda la última selección válida, se evita el cambio de foco en `pointerdown` y se restaura antes de aplicar formato o insertar símbolos.

### Alto — riesgo de sobrescritura en el autoguardado

Una modificación posterior podía producirse mientras una escritura anterior estaba pendiente. El guardado utiliza ahora números de revisión y programa una nueva persistencia cuando detecta cambios posteriores.

### Medio — fallo silencioso de inicialización

La función principal está protegida con manejo de errores y muestra un aviso visible con el mensaje técnico si el arranque falla.

### Medio — caché de versión anterior

Los recursos principales incluyen versión y el service worker usa una caché nueva.

## Archivos modificados

- `app.js`: selección, autoguardado y diagnóstico de inicio.
- `index.html`: versión, recursos versionados y aviso sin JavaScript.
- `styles.css`: estilo del diagnóstico.
- `sw.js`: caché v1.4.0.
- `manifest.webmanifest`: descripción actualizada.
- `README.md`: instrucciones estables.
- `CHANGELOG.md`: historial de cambios.

## Archivos añadidos

- `package.json`
- `tests/static-check.mjs`
- `VERIFICAR.bat`
- `INFORME_V1.4_STABLE.md`

## Verificación

- Sintaxis de `app.js` y `sw.js` con `node --check`.
- IDs HTML únicos.
- Todos los `data-action` tienen manejador.
- Recursos locales existentes.
- Manifest preparado para una subruta de GitHub Pages.
- Sin patrones evidentes de secretos.
- Integridad del ZIP final.

La ejecución visual automatizada con Chromium no terminó correctamente en el entorno de auditoría, por lo que la validación final de interacción debe hacerse manualmente en el navegador del usuario.

## Recomendación

Publicar esta v1.4.0 Stable en la rama `main`. Mantener cualquier reescritura modular futura en una rama separada hasta disponer de pruebas de navegador completas.
