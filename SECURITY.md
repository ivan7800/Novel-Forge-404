# Seguridad

## Modelo

Novel Forge 404 es una aplicación estática, local y sin backend. No incluye dependencias JavaScript de producción, autenticación ni sincronización remota.

Medidas incorporadas:

- CSP restrictiva y recursos del mismo origen.
- Saneamiento del HTML del editor y de proyectos importados.
- Saneamiento y límites para pistas, continuidad y comentarios.
- Límites de tamaño y descompresión para archivos importados.
- Validación de ZIP/DOCX contra cifrado, rutas peligrosas y expansión excesiva.
- Exportación EPUB construida únicamente desde HTML saneado.
- Confirmación de operaciones destructivas.
- Sin evaluación dinámica de código ni scripts importados.
- Acceso a carpetas únicamente tras autorización explícita del navegador.

## Consideraciones

- Una persona con acceso al perfil del navegador puede leer los proyectos locales.
- `.novel404`, DOCX y EPUB no están cifrados.
- Las carpetas vinculadas deben estar en una ubicación protegida por el usuario.
- La comparación de versiones y los detectores narrativos son herramientas auxiliares, no validaciones semánticas infalibles.
- La CSP permite estilos inline para personalización local, pero no scripts inline en la versión publicada.

## Comunicación de vulnerabilidades

No publiques manuscritos ni copias privadas en informes públicos. Utiliza un proyecto de prueba y describe los pasos mínimos de reproducción.
