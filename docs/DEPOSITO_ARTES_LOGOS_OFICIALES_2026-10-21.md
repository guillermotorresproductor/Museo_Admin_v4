# Depósito de Artes — actualización de identidad visual oficial (22-oct-2026)

## Alcance y repositorio

- Rama: `feature/deposito-artes-logos-oficiales-20261021`; PR #95 (borrador, sin fusionar).
- Página: `deposito-artes.html` y CSS exclusivo `css/deposito-artes.css`.
- Contenido: tres composiciones (horizontal, vertical, isotipo), cuatro variantes cada una.
- Recursos: 12 PNG y 12 PDF oficiales, sin conversiones ni recoloreado, en `assets/brand/oficial-2026/`.
- Archivo de integridad: `assets/brand/oficial-2026/manifest.json`.
- No se han modificado scripts comunes, autenticación, permisos, esquemas, políticas ni funciones de Supabase; tampoco los logos anteriores fuera de esta página.

## Evidencia técnica al 22-oct-2026

1. Los 24 recursos constan en el árbol del commit `275d0ec0ad80eab4c4deadeb194896ce8198f117` de la rama.
2. Se validaron los tamaños de los 24 recursos frente al manifiesto y sus hashes Git blob frente a los archivos del ZIP original. El ZIP también superó la verificación SHA-256 de sus 24 originales.
3. Validación estática del HTML en GitHub: 12 tarjetas, 3 categorías, 24 enlaces de descarga, 13 referencias de imagen, 0 referencias internas a rutas de logos inexistentes, 0 identificadores `aria-labelledby` rotos.
4. Prueba visual local del paquete de instalación (no equivale al entorno completo de Instituva): 13 imágenes cargadas; sin desbordamiento horizontal; cuatro columnas en escritorio y una en móvil. Esta prueba utilizó un CSS base simulado porque no se ejecutó el sistema autenticado.
5. El PR no tiene ejecuciones de CI ni comprobación HTTP 200 en un despliegue preview.

## Puerta de publicación pendiente

- Validar la rama en un preview accesible con los scripts y la sesión real de Instituva.
- Verificar HTTP 200 de las 24 descargas en ese preview y navegación/sidebar/permisos de sesión.
- Revisar escritorio/móvil dentro de ese preview.
- Obtener autorización final expresa de la Dirección para fusionar `main` y publicar en Cloudflare Pages.
- Verificar funcionamiento en `https://mmdpr.org/deposito-artes.html` después del despliegue y conservar rollback.

**No fusionar ni desplegar por el solo hecho de completar la carga o la prueba local.**

Fuente de los archivos oficiales: ZIP entregado por Dirección el 21-oct-2026. No contiene manual independiente, SVG ni JPG.
