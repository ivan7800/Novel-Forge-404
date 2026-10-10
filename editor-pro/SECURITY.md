# Seguridad — Novel Forge 404

## Modelo de seguridad

La aplicación es estática y no dispone de backend. El contenido permanece en el navegador y no se ejecutan servicios remotos.

## Controles aplicados

- Política de seguridad de contenido en `index.html`.
- Recursos limitados al mismo origen.
- Saneamiento de HTML pegado o importado.
- Eliminación de scripts, eventos, SVG, MathML, formularios, iframes y objetos incrustados.
- Límites de tamaño para archivos importados y contenido descomprimido.
- Rechazo de rutas ZIP con `..`, absolutas o inseguras.
- Rechazo de ZIP cifrados.
- Lectura EPUB basada en `container.xml`, OPF, manifiesto y spine.
- Exportaciones DOCX, EPUB y ZIP generadas sin contenido ejecutable.
- Nombres de archivo saneados.
- Enlaces y rutas relativos para GitHub Pages.

## Limitaciones

- Novel Forge no puede recuperar una copia cifrada o protegida por DRM.
- La seguridad de la carpeta vinculada depende de los permisos concedidos por el navegador.
- Un dispositivo comprometido puede acceder a datos locales igual que a otros archivos del usuario.
- La aplicación no sustituye una estrategia externa de copias de seguridad.

## Publicación segura

Publica siempre mediante HTTPS. GitHub Pages proporciona HTTPS, necesario para PWA, almacenamiento persistente y acceso a carpetas en navegadores compatibles.

## Reporte de problemas

No incluyas manuscritos privados ni datos personales en un informe público. Describe el problema, navegador, versión y pasos de reproducción con un proyecto de prueba.
