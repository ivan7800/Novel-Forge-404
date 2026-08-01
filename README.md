# Novel Forge 404 v1.2.0

**Novel Forge 404** es un estudio narrativo local para escribir, planificar, revisar y exportar novelas en español. Funciona sin cuentas, backend, telemetría ni subida de manuscritos.

## Funciones principales

### Escritura

- Proyectos, capítulos y escenas reordenables.
- Editor con autoguardado, sangría visual y modo enfoque.
- Raya de diálogo, comillas latinas e inglesas, puntos suspensivos y separadores de escena.
- Normalización tipográfica española.
- Pegado limpio o con formato básico.
- Editor dividido para trabajar con dos escenas simultáneamente.
- Lectura en voz alta mediante las voces del dispositivo.

### Planificación narrativa

- Vista de tarjetas por capítulos con arrastrar y soltar.
- Cronología ordenada por fecha y hora.
- Avisos de escenas sin fecha y personajes simultáneos en lugares distintos.
- Sistema de pistas con siembra, refuerzo, revelación y resolución.
- Continuidad avanzada mediante intervalos narrativos.
- Detección de valores contradictorios solapados.
- Biblia de personajes, lugares, objetos, organizaciones y reglas del mundo.
- Metadatos por escena: POV, estado, lugar, fecha, hora, acto, tensión, resumen, personajes, conocimiento, objetos, objetivo, conflicto y resultado.

### Revisión

- Comentarios vinculados a escenas y fragmentos.
- Estados pendiente, resuelto y reabierto.
- Instantáneas manuales y autocopias rotativas.
- Comparador de versiones línea por línea.
- Papelera recuperable.
- Búsqueda y reemplazo global.
- Estadísticas, repeticiones y salud narrativa.

### Importación y exportación

- Importación de TXT, Markdown, DOCX y `.novel404`.
- Exportación TXT y Markdown.
- Exportación DOCX editorial.
- Exportación EPUB 3 con portada tipográfica, índice y capítulos navegables.
- Copia integral `.novel404` versión 3.
- Guardado directo en una carpeta elegida en navegadores compatibles.

## Privacidad y almacenamiento

Los proyectos se guardan preferentemente en **IndexedDB**. La versión 1.2 migra automáticamente proyectos de versiones anteriores y añade los nuevos campos sin alterar capítulos ni manuscritos.

Las copias se gestionan en tres niveles:

1. Autoguardado continuo en IndexedDB.
2. Instantáneas manuales y autocopias rotativas dentro del proyecto.
3. Copias externas `.novel404`, manuales o escritas en una carpeta vinculada.

El acceso directo a carpetas usa File System Access API y funciona principalmente en Chrome y Edge bajo HTTPS o localhost. Firefox y Safari mantienen exportación manual completa.

## Uso local

En Windows:

```text
INICIAR_LOCAL.bat
```

En Linux o macOS:

```bash
chmod +x INICIAR_LOCAL.sh
./INICIAR_LOCAL.sh
```

Servidor manual:

```bash
python -m http.server 8080 --bind 127.0.0.1
```

Abre `http://127.0.0.1:8080/`.

Abrir `index.html` directamente permite usar gran parte de la aplicación, pero la PWA, el service worker y el acceso a carpetas requieren un contexto seguro.

## Publicación en GitHub Pages

1. Crea un repositorio, por ejemplo `Novel-Forge-404`.
2. Sube **el contenido interior** de esta carpeta a la raíz del repositorio.
3. Comprueba que `index.html`, `.nojekyll`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest` y `assets/` estén en la raíz.
4. Abre **Settings → Pages**.
5. En **Build and deployment**, selecciona **Deploy from a branch**.
6. Selecciona `main`, `/(root)` y pulsa **Save**.
7. Abre la URL HTTPS y recarga una vez para activar la PWA.
8. Crea una copia `.novel404` antes de sustituir una publicación anterior.

Todos los recursos usan rutas relativas y funcionan en un subdirectorio de GitHub Pages.

## Compatibilidad

Recomendado:

- Chrome y Edge actuales: experiencia completa y carpetas vinculadas.
- Firefox actual: editor, planificación, importación, exportación y PWA; sin guardado directo en carpeta.
- Safari actual: editor, planificación, importación, exportación y PWA; sin guardado directo en carpeta.

La importación DOCX conserva texto, párrafos, capítulos, negrita, cursiva, subrayado y separadores compatibles. No garantiza imágenes, tablas, notas al pie, comentarios de Word ni control de cambios.

## Estructura

```text
Novel-Forge-404/
├── index.html
├── styles.css
├── app.js
├── manifest.webmanifest
├── sw.js
├── assets/
├── INICIAR_LOCAL.bat
├── INICIAR_LOCAL.sh
├── README.md
├── CHANGELOG.md
├── PRIVACIDAD.md
├── SECURITY.md
├── INFORME_AUDITORIA.md
├── INFORME_V1.2.md
├── LICENSE.md
└── .nojekyll
```

## Comprobaciones técnicas

```bash
node --check app.js
node --check sw.js
python -m json.tool manifest.webmanifest
```

No hay compilación ni dependencias de producción.

## Licencia

Consulta `LICENSE.md`. Todos los derechos reservados para I. Roig salvo que se sustituya expresamente la licencia.
