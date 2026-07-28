# Inventario tecnico del proyecto

Actualizado: 2026-07-20  
Rama analizada: `docs/identity-architecture-phase-1`  
Commit base al realizar el inventario: `696db23` (`docs(architecture): add identity architecture`)

## 1. Resumen ejecutivo

Museo_Admin_v4 es una aplicacion web administrativa en espanol para el Museo de la Musica de Puerto Rico. La implementacion actual es un sitio multipagina sin proceso de compilacion, construido con HTML5, CSS3 y JavaScript ES6 y desplegable directamente en GitHub Pages.

La interfaz y la logica compartida estan centralizadas en `css/main.css` y `js/app.js`. La aplicacion ya integra Supabase Auth y la API REST de Supabase para perfiles, empleados, registros genericos, finanzas y auditoria. Varios modulos siguen usando datos iniciales en memoria o colecciones JSON guardadas en `app_records`; por tanto, la migracion desde prototipo estatico hacia una aplicacion multiusuario persiste como trabajo en curso.

La arquitectura objetivo usa el nombre de producto **Instituva**, separa identidad, perfil de acceso y expediente laboral, adopta RBAC, aislamiento multi-museo, auditoria transversal, almacenamiento privado para documentos laborales y una futura integracion contable con QuickBooks.

## 2. Plataforma y operacion

| Area | Estado actual |
|---|---|
| Frontend | HTML5, CSS3 y JavaScript ES6 puros; sin framework ni bundler |
| Estructura | Aplicacion multipagina con 23 archivos HTML en la raiz |
| UI compartida | Sidebar, encabezado, pie, iconos SVG y accesos de modulo generados desde `js/app.js` |
| Estilos | Hoja unica `css/main.css`, responsive mediante media queries |
| Backend | No existe backend propio en el repositorio |
| Servicio de datos | Supabase Auth y Supabase REST invocados directamente desde el navegador |
| Persistencia | Tablas estructuradas (`profiles`, `employees`, `finance_records`, `audit_logs`) y almacenamiento JSON temporal en `app_records` |
| Sesion local | `localStorage` para sesion Supabase, usuario visible, foto y nivel de acceso |
| Hosting | GitHub Pages; `.nojekyll` evita procesamiento de Jekyll |
| CI/CD | `.github/workflows/pages.yml` publica la raiz al hacer push a `main` o por ejecucion manual |
| Pruebas | No hay suite automatizada ni infraestructura de pruebas en el repositorio |
| Dependencias | No hay `package.json`, lockfile ni dependencias vendorizadas |

## 3. Estructura del repositorio

```text
/
|-- .github/workflows/pages.yml       # despliegue a GitHub Pages
|-- assets/                           # recursos institucionales y de marca
|   `-- brand/                        # logos, guia de marca y ejemplo de papeleria
|-- css/main.css                      # sistema visual completo
|-- docs/                             # documentos, SQL y arquitectura
|   `-- architecture/                 # arquitectura funcional y tecnica
|-- images/                           # logo operativo y papeleria mostrada por la UI
|-- js/app.js                         # navegacion, componentes y logica de todos los modulos
|-- pdf/reglamento-museo-musica.pdf   # reglamento descargable
|-- *.html                            # paginas de la aplicacion
|-- CODEX_RULES.md                    # reglas locales de mantenimiento
|-- PROJECT_SPEC.md                   # especificacion corta y credenciales demo historicas
|-- MUSEO_ADMIN_V4_MASTER_SPEC.md     # alcance funcional maestro v4.0
|-- README.md                         # descripcion minima del proyecto
|-- CHANGELOG.md                      # historial resumido
|-- ROADMAP.md                        # fases generales
|-- STYLE_GUIDE.md                    # lineamientos visuales breves
`-- PROJECT_INVENTORY.md              # este inventario
```

## 4. Paginas y modulos implementados

Todas las paginas cargan `css/main.css` y `js/app.js`; la estructura comun se inyecta en elementos con atributos `data-sidebar`, `data-header` y `data-footer`.

| Archivo | Modulo o responsabilidad |
|---|---|
| `index.html`, `dashboard.html` | Dashboard y accesos principales |
| `login.html` | Inicio de sesion mediante Supabase Auth |
| `administracion.html` | Portal de Recursos Humanos, Notificaciones, Reportes y Finanzas |
| `recursos-humanos.html` | Directorio y gestion de expedientes de empleados |
| `perfil-empleado.html` | Consulta y edicion del perfil laboral |
| `empleados.html` | Solicitud de empleo para candidatos |
| `notificaciones.html` | Preferencias administrativas de alertas; no es un motor de entrega |
| `finanzas.html` | Presupuesto fiscal, registros financieros y exportacion; acceso restringido en frontend |
| `reportes.html` | Pagina placeholder, pendiente de programacion |
| `calendario.html` | Calendario de eventos y compromisos oficiales |
| `ujieres.html` | Calendario mensual de ujieres, horarios y areas |
| `mantenimiento.html` | Portal del dominio de mantenimiento |
| `calendario-obras.html` | Asignacion mensual de personal, tareas y areas |
| `solicitud-materiales.html` | Registro de solicitudes de materiales |
| `ruta-digital.html` | Recorrido y control de mantenimiento por areas |
| `renta-espacios.html` | Solicitud, tarifas, disponibilidad e impresion de renta de espacios |
| `inventario.html` | Inventario administrativo de equipos, mobiliario, instrumentos y obras |
| `documentos.html` | Portal de formularios y papeleria |
| `deposito-artes.html` | Catalogo descargable de logos, artes y guia de marca |
| `recibo-prestamo.html` | Formulario museografico de recibo/prestamo de articulos |
| `reglamento.html` | Consulta, impresion y descarga del reglamento |
| `boletin.html` | Tablero de anuncios y comunicaciones internas |

## 5. Implementacion JavaScript

`js/app.js` es un archivo monolitico de aproximadamente 152 KB. La decision ADR-008 establece expresamente que todavia no debe modularizarse para evitar mezclar una refactorizacion amplia con la fase de seguridad.

Responsabilidades identificadas:

- metadatos de paginas, navegacion lateral, accesos de modulo e iconos SVG;
- renderizado de sidebar, encabezado, pie y acciones globales;
- autenticacion, renovacion y cierre de sesion con Supabase Auth;
- resolucion del contexto `museum_id` a partir de `profiles`;
- adaptadores REST para `app_records`, `employees`, `finance_records` y `audit_logs`;
- cache local del usuario, fotografia y nivel de acceso;
- perfiles demo iniciales y datos iniciales de finanzas y renta;
- formularios de renta, recibos museograficos, inventario, calendarios, materiales y RRHH;
- preferencias de notificaciones;
- calculos, guardado, consulta, auditoria y exportacion de finanzas;
- perfil de empleado, sanitizacion basica de HTML e inicializacion general.

Claves locales declaradas:

- `museo-admin-supabase-session`
- `museo-admin-current-user`
- `museo-admin-current-user-photo`
- `museo-admin-access-level`

La URL de Supabase y la clave publicable estan incluidas en el frontend, como corresponde a un cliente web; la seguridad efectiva depende de Auth, RLS y de no exponer una clave `service_role`.

## 6. Datos y seguridad Supabase

### Integracion usada por el frontend

- `auth/v1/token`: inicio y renovacion de sesion.
- `profiles`: identidad visible, rol actual y pertenencia al museo.
- `employees`: expedientes laborales estructurados.
- `app_records`: colecciones JSON temporales por museo, modulo y clave.
- `finance_records`: registros presupuestarios y financieros.
- `audit_logs`: eventos de auditoria asociados a finanzas.

### Scripts incluidos

- `docs/supabase-system-records.sql`: crea `public.app_records`, activa RLS y define politicas CRUD limitadas al `museum_id` del perfil autenticado.
- `docs/supabase-finance-security.sql`: activa RLS de forma condicional para `finance_records` y `audit_logs`; limita operaciones a usuarios autenticados del mismo museo cuyos roles actuales sean `administrador` o `ejecutivo`.

Estos scripts son artefactos de configuracion manual; el repositorio no contiene un directorio formal de migraciones ni evidencia automatizada de que el esquema remoto coincida con ellos.

## 7. Estado funcional por dominio

| Dominio | Estado observado |
|---|---|
| Identidad | Supabase Auth funciona desde el navegador; el modelo objetivo completo Auth/Profile/Employee y RBAC aun esta planificado |
| Recursos Humanos | Auditado y estabilizado; CRUD sobre empleados Supabase, con datos demo/locales como respaldo |
| Notificaciones | Auditado como configurador de preferencias en `app_records`; sin eventos ni canales de entrega |
| Finanzas | Implementacion funcional con registros Supabase, control de rol en UI/RLS y auditoria; QuickBooks es la fuente contable futura |
| Colecciones | Formularios e inventario existentes, con arquitectura de dominio y ciclo de vida ampliamente documentados; no hay modelo persistente especializado completo en el repo |
| Mantenimiento | Calendario de obras, materiales y ruta digital implementados en la UI |
| Calendarios y renta | Formularios y flujos interactivos implementados en el cliente |
| Reportes | Placeholder pendiente |
| Boletin | Vista estatica/administrativa basica |

## 8. Documentacion de arquitectura

`docs/architecture/` contiene 14 documentos. Los documentos `00` a `09` definen la arquitectura de producto y dominios; los cuatro documentos adicionales concretan decisiones, permisos y ejecucion de la primera fase de identidad.

| Documento | Contenido y estado |
|---|---|
| `00_SYSTEM_ARCHITECTURE.md` | Arquitectura general de Instituva: fuente oficial unica, modulos propietarios/integradores, limites con sistemas externos y flujo obligatorio de evolucion |
| `01_PRODUCT_VISION.md` | Proposito, vision, dominio central, dominios de soporte, principios de producto/experiencia y publico objetivo |
| `02_COLLECTIONS_ARCHITECTURE.md` | Limites del dominio Colecciones, pieza y expediente museografico, titularidad, custodia, ciclo de vida, trazabilidad y relaciones con otros dominios |
| `03_UBIQUITOUS_LANGUAGE.md` | Vocabulario oficial del dominio museografico: pieza, patrimonio, expediente, adquisicion, prestamo, ubicacion, condicion, valores, estados, historial, auditoria y responsables |
| `04_COLLECTIONS_LIFECYCLE.md` | Estados, eventos, transiciones permitidas/prohibidas, historial permanente e integraciones del ciclo de vida de una pieza |
| `05_HUMAN_RESOURCES.md` | Auditoria de RRHH: cambios minimos aplicados, elementos conservados y trabajo aplazado para Auth, RBAC, Edge Functions y soft delete |
| `06_NOTIFICATIONS.md` | Auditoria de Notificaciones: alcance limitado a preferencias; motor de eventos, historial y canales quedan para v2 |
| `07_FINANCE_ARCHITECTURE.md` | Separacion entre workflows administrativos de Instituva y contabilidad oficial futura en QuickBooks; sincronizacion, consultas, componentes y riesgos de migracion |
| `08_AUDIT_AND_TRACEABILITY.md` | Modelo transversal de estado, historial y auditoria; eventos auditables, informacion minima, inmutabilidad, privacidad y experiencia de consulta |
| `09_IDENTITY_ARCHITECTURE.md` | Arquitectura conceptual de identidad humana, institucional, de sistema y de IA; gobernanza, ciclo de vida, auditoria, UX y limites |
| `identity-access-model.md` | Separacion detallada entre `auth.users`, `profiles` y `employees`, relaciones, ciclos de vida, fuentes de verdad, riesgos y decisiones pendientes |
| `roles-permissions-matrix.md` | Separacion entre puesto laboral y permiso; roles iniciales, matriz RBAC y reglas obligatorias |
| `decision-log.md` | ADR-001 a ADR-010, todas aprobadas: Supabase Auth, separacion Auth/Profile/Employee, RBAC, permiso financiero independiente, multi-museo, storage privado, Edge Functions, aplazamiento de modularizacion, uso temporal de `app_records` y QuickBooks futuro |
| `phase-1-implementation-plan.md` | Plan futuro por etapas: inventario real de Supabase, migraciones, RBAC, vinculo de identidad, seguridad frontend, Edge Functions, RLS y pruebas; delimita lo excluido de Fase 1 |

### Principios arquitectonicos vigentes

- una sola fuente oficial para cada tipo de informacion;
- aislamiento de datos por `museum_id`;
- Supabase Auth como identidad oficial;
- separacion entre cuenta de acceso, perfil y expediente laboral;
- autorizacion futura mediante roles y permisos explicitos, no solo etiquetas de rol;
- Finanzas como permiso independiente y sensible;
- auditoria inmutable y transversal;
- documentos laborales en almacenamiento privado;
- operaciones privilegiadas en Edge Functions o backend seguro;
- `app_records` como compatibilidad temporal, no como modelo definitivo;
- QuickBooks como futura fuente oficial de contabilidad y nomina.

## 9. Documentacion y activos adicionales

### Documentos de negocio y formularios

- `docs/folleto-institucional-reglamento-museo.docx`: folleto/reglamento institucional editable.
- `docs/formulario-recibo-articulos-coleccion-prestamo.docx`: formulario fuente para recibos de coleccion/prestamo.
- `pdf/reglamento-museo-musica.pdf`: reglamento publicado por la interfaz.

### Marca

- `images/logo-horizontal.jpg`: logo operativo exigido por `PROJECT_SPEC.md`.
- `assets/brand/`: guia de marca PDF, logos PDF/PNG/JPG/SVG, composiciones y ejemplo de papeleria.
- Existen copias historicas adicionales del logo en la raiz y recursos de papeleria tanto en `assets/` como en `images/`; no se eliminaron ni consolidaron como parte de este inventario.

## 10. Especificaciones y reglas del repositorio

- `CODEX_RULES.md`: obliga a leer las especificaciones, conservar el diseno y el logo, mantener modularidad y evitar duplicacion.
- `PROJECT_SPEC.md`: fija tecnologias, objetivo, credenciales demo historicas y el logo permitido.
- `MUSEO_ADMIN_V4_MASTER_SPEC.md`: define vision, principios, identidad visual, modulos, requisitos funcionales y fases 4.0 a 5.0.
- `STYLE_GUIDE.md`: resume las reglas visuales.
- `ROADMAP.md`: conserva la secuencia general de fases.
- `CHANGELOG.md`: registro minimo de la version inicial.

## 11. Brechas y riesgos tecnicos visibles

- La autorizacion del frontend depende parcialmente de valores de rol guardados en `localStorage`; la arquitectura documentada exige que la autorizacion definitiva resida en RLS/backend y RBAC.
- La matriz RBAC, sus tablas y la vinculacion opcional `employees.auth_user_id` estan diseñadas, pero no implementadas mediante migraciones versionadas en este repositorio.
- Las operaciones sensibles de usuarios, contraseñas, roles y archivos privados aun no cuentan con Edge Functions incluidas.
- `app_records` mantiene compatibilidad para varios modulos, pero no ofrece un modelo relacional de dominio definitivo.
- El esquema remoto de Supabase no puede reconstruirse integramente desde los dos scripts SQL presentes.
- No hay pruebas automatizadas de interfaz, dominio, RLS o integracion.
- `js/app.js` concentra toda la logica; su modularizacion esta conscientemente aplazada por ADR-008.
- `reportes.html` sigue pendiente de implementacion.
- La documentacion historica usa tanto Museo_Admin_v4 como Instituva; Instituva representa la arquitectura/producto objetivo y Museo_Admin_v4 el repositorio e implementacion actual.

## 12. Alcance de este inventario

El inventario describe los archivos y el comportamiento observable en la rama indicada. No valida el estado del proyecto Supabase remoto, no ejecuta los scripts SQL, no prueba credenciales ni servicios externos y no modifica codigo, configuracion o activos.
