# Privacidad — Novel Forge 404

Novel Forge 404 procesa manuscritos, fichas, comentarios y archivos íntegramente en el dispositivo del usuario.

## Datos locales

- Los proyectos se guardan preferentemente en IndexedDB.
- Las preferencias ligeras pueden utilizar localStorage.
- Las instantáneas y autocopias permanecen dentro del proyecto local.
- No se envían manuscritos, estadísticas ni metadatos a servidores externos.
- No existen cuentas, publicidad, analítica ni telemetría.

## Importación

TXT, Markdown, DOCX, EPUB, JSON y `.novel404` se leen localmente. El contenido HTML importado se sanea antes de incorporarse al editor.

Los EPUB con DRM o archivos comprimidos cifrados no son compatibles.

## Exportación

DOCX, EPUB, HTML, Markdown, TXT, ZIP, JSON y `.novel404` se generan en el navegador. La opción PDF utiliza el cuadro de impresión del navegador; el contenido no se envía a Novel Forge 404.

Al guardar en una carpeta vinculada, el navegador solicita permiso explícito. Novel Forge solo escribe las copias que el usuario ordena.

## Recomendación

El almacenamiento del navegador puede borrarse por limpieza de datos, políticas corporativas, modo privado o restablecimiento del dispositivo. Mantén copias externas `.novel404` y, para máxima interoperabilidad, un paquete ZIP o DOCX actualizado.
