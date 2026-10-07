# INSTITUVA v4.1

Production Baseline  
Fecha: 6 de octubre de 2026

v4.1 es el primer baseline formal documentado. El CHANGELOG anterior solo registraba v4.0 como inicio del proyecto. No se reconstruyen versiones intermedias.

## Identificación

| | |
|---|---|
| Versión | INSTITUVA v4.1 |
| Tag | `v4.1.0` |
| Baseline funcional | `2e6998d5c062b0e9e103bcce1e849356e53e3657` |
| Deployment de ese baseline | `80c2d438-9d31-4d4f-9e25-0b912f62a3fa` |
| Producción | https://mmdpr.org |
| Proyecto Pages | `instituva-app`, rama `main` |
| Repositorio | `Museo_Admin_v4` |

El tag `v4.1.0` apunta al commit de esta documentación. Ese commit no cambia el comportamiento de la aplicación. El código desplegado en el deployment indicado es el baseline funcional.

## Cómo se versiona el proyecto

No hay `package.json` ni una constante de versión de la aplicación. `manifest.webmanifest` no tiene campo de versión. `sw.js` no nombra un caché: responde cada petición por red.

Las páginas y el pie muestran el rótulo histórico «Museo Admin v4.0» y «Sistema Administrativo v4.0». Ese rótulo no se cambió en v4.1. Cambiarlo alteraría la interfaz y exigiría otro despliegue. La versión formal queda en este documento, en `CHANGELOG.md` y en el tag.

## Componentes operativos en este baseline

Lo siguiente existe en el código de `2e6998d5c062b0e9e103bcce1e849356e53e3657`.

- Administración (`administracion.html`).
- Dirección Ejecutiva (`direccion-ejecutiva.html`).
- Recursos Humanos (`recursos-humanos.html`), personal y perfiles (`perfil-empleado.html`).
- Horarios y turnos (`attendance_schedule_rules`, `employee_shifts`).
- Ponches (`attendance_events`) y la consulta de Asistencia, en `reportes.html` y en Finanzas → Asistencia, mediante `list_attendance_history`.
- Correcciones de asistencia ya existentes en ese módulo.
- Nómina real (`js/payroll-actual.js`), en `reportes.html` y en Finanzas → Nómina.
- Finanzas (`finanzas.html`): Resumen, Ingresos, Gastos, Facturas, Cheques, Nómina, Asistencia, Reportes y Configuración.
- Cheques en borrador, emitido y anulado, con impresión sobre el modelo ArteGrafiko. Las coordenadas están en `financeCheckPrintLayout`. El indicador `calibrated` sigue en `false` y la vista previa dice que las posiciones no están calibradas al papel físico.
- Museología e inventario de colecciones, con expediente de ingreso (`ingreso-articulo.html`): donación permanente, préstamo temporal, firmas, recepción, devolución e historial de versiones del expediente.
- Roles y permisos de la aplicación (`has_permission` y perfiles de acceso). La matriz de `docs/architecture/` es un borrador de arquitectura, no el catálogo en ejecución.
- PWA instalable: `manifest.webmanifest` y `sw.js`. El service worker no guarda un caché propio.
- Despliegue de producción en Cloudflare Pages, dominio https://mmdpr.org.

## Fuera de este registro

Cualquier funcionalidad nueva queda para el backlog de INSTITUVA v4.2.
