# Privacidad

Novel Forge 404 no incluye cuentas, analítica, telemetría, publicidad ni servicios externos.

## Tratamiento de datos

- Manuscritos, fichas, pistas, continuidad y comentarios se procesan en el dispositivo.
- La aplicación no envía contenido a servidores propios ni de terceros.
- IndexedDB almacena proyectos e instantáneas.
- `localStorage` solo se utiliza para preferencias, proyecto activo y compatibilidad.
- La lectura en voz alta emplea las voces disponibles en el dispositivo.

## Carpetas vinculadas

En navegadores compatibles, el usuario puede elegir una carpeta mediante File System Access API. La aplicación conserva el identificador de acceso en IndexedDB y solo escribe archivos después de recibir permiso del navegador.

- No explora otras carpetas.
- No sube los archivos.
- La carpeta puede desvincularse sin borrar su contenido.
- El navegador puede retirar el permiso y exigir una nueva autorización.

## Copias

Las autocopias internas no sustituyen una copia externa. Los datos locales pueden perderse al borrar datos del sitio, usar navegación privada, cambiar de perfil o sufrir daños en el dispositivo.

Se recomienda conservar periódicamente una copia `.novel404` fuera del navegador.

## Publicación propia

Esta declaración describe la versión entregada sin modificaciones. Revisa cualquier analítica, fuente, script, API o servicio externo que añadas posteriormente.
