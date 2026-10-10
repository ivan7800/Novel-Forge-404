# Changelog

## 1.4.0 Stable

- Recuperada la v1.3 como base oficial estable.
- Conservado el arranque clásico con un único `app.js` para evitar fallos globales de módulos.
- Corregida una condición de carrera del autoguardado mediante revisiones pendientes.
- Conservada y restaurada la selección del editor al usar la barra tipográfica.
- Evitada la pérdida de foco al pulsar botones de formato.
- Añadido diagnóstico visible si la aplicación no puede inicializarse.
- Eliminado el guardado asíncrono poco fiable en `beforeunload`; se mantiene `pagehide`.
- Versionados CSS y JavaScript para reducir mezclas de caché.
- Actualizada la caché PWA a `novel-forge-404-v1.4.0`.
- Añadida verificación estática reproducible y documentación limpia.
