# Historial de cambios

## 1.2.0 — 2026-08-01

### Planificación narrativa

- Nueva vista de tarjetas por capítulos con arrastrar y soltar escenas.
- Cronología por fecha y hora, escenas sin fechar y conflictos simultáneos básicos.
- Sistema de pistas con estados, siembra, refuerzo, revelación y resolución.
- Continuidad avanzada por entidad, atributo, valor e intervalo de escenas.
- Detección de hechos contradictorios que se solapan.
- Nuevos metadatos: tensión, resumen, participantes, conocimiento y objetos/estado.

### Revisión y productividad

- Comentarios vinculados a escenas y fragmentos, con resolución y reapertura.
- Comparación línea por línea entre la escena actual y una instantánea.
- Editor dividido editable con selector de escena secundaria.
- Autocopias rotativas configurables y avisos por falta de copia externa.
- Conservación separada de hasta diez instantáneas manuales y diez automáticas.

### Archivos y publicación

- Exportación EPUB 3 con portada tipográfica, índice y capítulos XHTML.
- Copias `.novel404` versión 3 con pistas, continuidad y comentarios.
- Guardado directo opcional mediante File System Access API.
- Escritura automática de una copia rotativa en la carpeta vinculada cuando el permiso sigue concedido.
- Caché PWA actualizada a la versión 1.2.0.

### UX, seguridad y compatibilidad

- Navegación lateral ampliada y adaptada a móvil.
- Saneamiento de los nuevos datos importados y referencias migradas.
- Referencias de escenas regeneradas correctamente al importar una copia como proyecto nuevo.
- Diseño responsive verificado sin desbordamiento de página a 390 px.

## 1.1.0 — 2026-08-01

### Datos y fiabilidad

- Migración del almacenamiento principal de `localStorage` a IndexedDB.
- Migración automática de proyectos de la versión 1.0.0.
- Respaldo controlado en `localStorage` cuando IndexedDB no está disponible.
- Avisos visibles ante fallos de persistencia y estado del almacenamiento.
- Solicitud opcional de almacenamiento persistente del navegador.
- Copias `.novel404` versión 2 con fecha de respaldo.
- Instantáneas restaurables, eliminación controlada y copia previa automática.
- Saneamiento y validación de proyectos importados.

### Importación y exportación

- Importación DOCX mejorada con conservación de negrita, cursiva y subrayado.
- Detección de capítulos, prólogo, epílogo y partes.
- Eliminación de duplicados de portada y autor al reimportar un DOCX exportado.
- Límites de tamaño, número de entradas y descompresión para archivos DOCX/ZIP.
- Comprobaciones contra ZIP cifrado, entradas peligrosas y archivos desproporcionados.
- Normalización tipográfica sin destruir formato enriquecido.

### UX, móvil y accesibilidad

- Menú móvil con acceso a crear, importar, exportar, proyecto, ajustes y enfoque.
- Paneles laterales móviles con fondo de cierre y objetivos táctiles mínimos.
- Mejoras de contraste en temas oscuro, claro y sepia.
- Etiquetas accesibles, estados `aria-pressed`/`aria-expanded` y ayuda del editor.
- Separación de controles interactivos en el árbol de capítulos y escenas.
- Gestión de foco al abrir y cerrar diálogos.
- Confirmaciones antes de borrados destructivos.
- Recuperación de fichas de la biblia desde la papelera.

### PWA y seguridad

- Service worker actualizado con estrategia segura para navegación y recursos locales.
- Caché limitada al mismo origen y limpieza de cachés antiguas.
- Manifest ampliado con identificador, categorías y propósitos de icono.
- Política CSP local sin scripts externos, objetos ni conexiones remotas.
- Documentación, privacidad, seguridad, licencia e instrucciones de publicación revisadas.

## 1.0.0 — 2026-08-01

- Primera versión funcional.
- Proyectos, capítulos, escenas y metadatos narrativos.
- Editor tipográfico español y pegado de textos existentes.
- Importación TXT, Markdown, DOCX y copias Novel 404.
- Exportación TXT, Markdown, DOCX y `.novel404`.
- Biblia narrativa, análisis, papelera, instantáneas y PWA.
- Diseño adaptable a escritorio, tableta y móvil.
