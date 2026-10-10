# Auditoría de entrega — Novel Forge 404, GitHub RC

## Comprobado aquí
- 50/50 tests de Node con `node --test tests/*.test.mjs`: PASS.
- `node --check` para todos los módulos JS, bootstrap y ambos Service Workers: PASS.
- Cachés independientes: `editor-pro/sw.js` solo elimina versiones anteriores con prefijo `novel-forge-404-`; **no borra** la caché `storyverse-404-static-*`.
- Rutas de aplicación y recursos estáticos relativos y paquete ZIP íntegro.
- Playwright/Chromium: intento efectuado; `ERR_BLOCKED_BY_ADMINISTRATOR` en `127.0.0.1`; ningún clic de navegador ha sido certificado en este entorno.

## Pendiente de comprobar con navegador real, ANTES de reemplazar GitHub
1. Abre `INICIAR_NOVEL_FORGE.bat` y verifica que aparecen y funcionan las dos vistas.
2. Editor profesional: crea proyecto y escena, escribe, recarga, exporta **su propio backup**, vuelve a importar en perfil de prueba y comprueba formato y palabras.
3. Inicio: pulsa «Transferir novela», selecciona tu obra y verifica capítulo, escena y fichas. **Comprueba que el original no cambia**.
4. En inteligencia narrativa: personajes, mapa, cronología, guardar hecho, ejecutar auditoría, exportar JSON, importar JSON y restaurar versiones.
5. Abre las dos vistas, desconecta Internet, recarga cada una y comprueba que arrancan offline tras instalar la PWA.
6. Actualiza la PWA y verifica que ambos espacios siguen abriendo y sus manuscritos siguen presentes.
7. Móvil: prueba navegación, teclado, modales y scroll.
8. GitHub Pages en `/Novel-Forge-404/`: revisa consola y pestaña Network sin 404.

## Riesgos que siguen abiertos
- Son DOS bases independientes, no una fusión de edición simultánea. Transferencias repetidas crean copias.
- Las dos PWA tienen alcances solapados: la ruta `/editor-pro/` debe estar controlada por su SW más específico; verificarlo en navegador.
- No hay validación E2E completada para todos los botones; no asignar estado STABLE automáticamente.
- Cada origen web tiene su propia base de datos: publicación no migra manuscritos de forma automática.
