# Novel Forge 404 v1.4.0 Stable

Editor y estudio narrativo local para escribir, organizar, revisar y exportar novelas en español. Esta versión estable parte del núcleo probado de la v1.3 y evita la reescritura modular experimental de la rama v2.

## Funciones principales

- Proyectos, capítulos y escenas.
- Pegado e importación de TXT, Markdown, DOCX, EPUB y copias `.novel404`.
- Tipografía española: raya, comillas latinas, puntos suspensivos y normalización.
- Tarjetas, cronología, pistas, continuidad, comentarios y biblia narrativa.
- Editor dividido, instantáneas, autocopias y papelera.
- Exportación TXT, Markdown, HTML, DOCX, EPUB, ZIP, JSON y `.novel404`.
- PWA local, sin cuentas, backend, telemetría ni dependencias externas.

## Uso local

La forma más simple es abrir `index.html`. Para probar instalación PWA y modo offline, usa un servidor local:

### Windows

Ejecuta `INICIAR_LOCAL.bat`.

### Linux o macOS

```bash
chmod +x INICIAR_LOCAL.sh
./INICIAR_LOCAL.sh
```

También puedes usar:

```bash
python -m http.server 8080
```

Y abrir `http://127.0.0.1:8080/`.

## Verificación técnica

La aplicación no necesita Node.js para funcionar. Si tienes Node.js instalado:

```bash
npm run verify
```

## GitHub Pages

1. Sube el contenido de esta carpeta a la raíz del repositorio.
2. Comprueba que `index.html` y `.nojekyll` están en la raíz.
3. En **Settings → Pages**, selecciona **Deploy from a branch**.
4. Selecciona `main` y `/(root)`.
5. Abre la URL HTTPS y recarga una vez para actualizar el service worker.

## Seguridad de los manuscritos

Los proyectos se guardan en IndexedDB con respaldo local cuando es posible. Exporta periódicamente una copia `.novel404`; el almacenamiento del navegador no sustituye una copia externa.
