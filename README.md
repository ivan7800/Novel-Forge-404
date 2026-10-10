# Novel Forge 404 — Edición unificada (GitHub RC)

Estudio local de novelas con **Editor profesional** (`editor-pro/`) e **Inteligencia narrativa** (inicio). Incluye formato enriquecido y exportación editorial, fichas, cronología, mapa, detección de posibles contradicciones y una transferencia **unidireccional mediante copia**.

## Ejecutar
- Windows: extrae completamente los archivos y ejecuta `INICIAR_NOVEL_FORGE.bat` (requiere Python 3).
- En local: `python -m http.server 8765`, luego abre `http://127.0.0.1:8765/`.
- GitHub Pages: publica **el contenido** de esta carpeta en la raíz del repositorio `Novel-Forge-404`. Las rutas son relativas para `https://usuario.github.io/Novel-Forge-404/`.
- Entra en **Editor profesional** y escribe/importa. Para analizar una obra, vuelve al inicio y pulsa **Transferir novela**.

## Protección de datos y límites
- **Cada espacio usa su propia IndexedDB**. Transferir crea una copia en texto plano en inteligencia narrativa; **NO sincroniza** cambios posteriores ni conserva el formato enriquecido en la copia. Los originales del editor profesional no se modifican.
- **Haz respaldos por separado** de ambos espacios; una transferencia no es una copia de seguridad fiable.
- La papelera del espacio de inteligencia narrativa no entra en su JSON de respaldo: restaura los elementos antes de exportar.
- **El almacenamiento depende del origen**: `localhost`, `127.0.0.1` y GitHub Pages guardan información diferente. Para migrar una instalación existente en GitHub Pages, exporta el respaldo del editor antiguo e impórtalo en el nuevo.
- No borres el repositorio antiguo ni los datos del navegador antes de comprobar la restauración de tus respaldos.
- IA local opcional: solamente al solicitar expresamente el análisis de una escena se envía contenido al servidor local elegido.

## Estado de calidad
Pruebas de lógica: **50/50 superadas** en la preparación de esta entrega; sintaxis JS correcta. Se corrigió una interferencia de cachés entre las dos PWA y el arranque del lector de la base editorial cuando está ausente. La navegación mediante clic, funcionamiento offline y migración real en Windows/GitHub Pages **siguen pendientes de ejecución**, por lo que la etiqueta es **GitHub RC**, no STABLE.

Ver [`QA-GITHUB.md`](QA-GITHUB.md) y [`tests/`](tests/). **No se ha publicado nada automáticamente.**
