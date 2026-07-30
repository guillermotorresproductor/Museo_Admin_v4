# Reglamento, gobernanza y plan de cambios (solo documentación)

**Fecha:** 28 de julio de 2026  
**Propósito:** Mantener la programación alineada con el **Reglamento del Museo** (normas del Municipio Autónomo de Guaynabo / MAG), la gobernanza INSTITUVA y el trabajo ya hilado en código. **No sustituye** el PDF oficial; lo referencia como autoridad normativa.

---

## 1. Jerarquía de fuentes (orden de verdad)

| Prioridad | Fuente | Ubicación en repo |
|-----------|--------|-------------------|
| 1 | **Reglamento oficial (PDF)** | `pdf/reglamento-museo-musica.pdf` — consulta en `reglamento.html` |
| 2 | **Decisiones operacionales aprobadas** (renta, fianza, recibos MAG, membresías, compras) | `Instituva_App/docs/architecture/CURRENT_IMPLEMENTATION_STATUS.md` §9; `13_EXECUTIVE_DIRECTION_MODULE.md` |
| 3 | **Gobernanza de producto** (categorías, permisos, portal, asistencia) | `Instituva_App/docs/PROJECT_STATUS_AND_MODULE_ROADMAP.md`; `12_EMPLOYEE_PORTAL.md`; `Museo_Admin_v4/docs/architecture/roles-permissions-matrix.md`, `10_ATTENDANCE_BUSINESS_RULES.md` |
| 4 | **Especificación maestra v4** (módulos y reglas de diseño) | `MUSEO_ADMIN_V4_MASTER_SPEC.md` |
| 5 | **Implementación en código** | Debe **trazarse** a 1–3; si no hay traza, es deuda normativa |

**Regla para todo cambio futuro:** ninguna regla de negocio nueva solo en el frontend; recibos, aprobaciones y activaciones deben poder explicarse con el reglamento y validarse en servidor (RLS / RPC / Edge Functions), como ya ocurre en renta y membresías del museo.

**Política UI congelada (julio 2026):** no cambiar estética, montaje, orden de módulos ni flujos visibles para empleado regular / ejecutivo / administrador. Ver `docs/POLITICA_UI_CONGELADA.md`. Optimización solo en backend, datos e infraestructura.

---

## 2. Reglamento en la interfaz (estado actual)

| Canal | Qué hace hoy | Alineación reglamento |
|-------|----------------|------------------------|
| **Museo web** `reglamento.html` | Muestra y descarga `pdf/reglamento-museo-musica.pdf` | Cumple consulta/descarga (spec §15). Buscador/impresión del spec: **solo si se autoriza** (UI congelada). |
| **Instituva app** `/mi-portal/reglamento` | Reglamentos versionados en BD, URL firmada, `acknowledge_regulation` (migración `0033`) | Alineado a **confirmación de lectura** y auditoría; requiere **publicar** el PDF vigente en Supabase Instituva. |
| **Portal por categoría** | Módulo `regulations` en paquetes (Administración, Operaciones, RRHH, etc.) | Coherente: reglamento accesible según categoría + permiso `regulations.read`. |

**Brecha crítica:** hoy el PDF canónico vive en **Museo_Admin_v4**; Instituva espera `organization_regulations` en **instituva-development**. Hasta publicar la misma versión allí, empleados en app y empleados en web no ven la **misma fuente versionada**.

---

## 3. Trazabilidad reglamento → programación (verificado en repo)

### 3.1 Renta de espacios y uso municipal

| Norma / principio (reglamento + decisiones §9 Instituva) | Dónde está programado | Verificación |
|----------------------------------------------------------|----------------------|--------------|
| Aprobación previa MAG; actividad compatible con fines del museo; póliza; pago en Recaudaciones; no daños; revocatoria MAG | `js/app.js` → `rentalGeneralRules[]` (texto en solicitud/UI) | Texto explícito MAG / Guaynabo |
| Nombres oficiales de espacios vs nombres comerciales | `defaultRentalSpaces[].regulatoryName` + `name` | Trazabilidad normativa en ficha pública |
| Canon, fianza, horas mínimas (ej. salón multiuso $300 / $50 fianza evento completo; por horas sin fianza) | `defaultRentalSpaces` (`canon`, `deposit`, `hourlyRate`, `requirements[]`) | Coincide con reglas en copy del espacio |
| Recibo municipal antes de aprobar; no reutilizar recibo; producción interna exenta | `docs/supabase-rental-approval-controls.sql` + `app.js` (`record_rental_municipal_receipt`, `set_rental_approval`) | **Servidor** impide aprobar sin recibo salvo excepción |
| Dos pagos (renta y fianza); MAG custodia fianza; **ArteGrafiko no recibe/devuelve fianza** | `CURRENT_IMPLEMENTATION_STATUS.md` §9.1; `13_EXECUTIVE_DIRECTION_MODULE.md` §8.2 | Documentado; UI museo separa recibo; Dirección Ejecutiva define flujo de disposición de fianza (0039) |
| Aprobación final Dirección Ejecutiva | Instituva conserva `executive_cases` y las reglas; Museo presenta la bandeja mediante el puente seguro | Una fuente de datos y dos superficies independientes: website administrativo y app móvil |

### 3.2 Membresías

| Norma | Programación | Verificación |
|-------|--------------|--------------|
| Recibo MAG antes de activar (excepto cortesía) | `membresias.html` + `app.js` + `docs/supabase-membership-municipal-receipt.sql` (CHECK + índice único) | UI + constraint BD en museo prod |
| Revisión empleado + aprobación ejecutiva | Gobernanza §9.2 Instituva; flujo membresías Museo parcialmente en UI | Pendiente cierre en Dirección Ejecutiva |

### 3.3 Personal, portal y reglamento laboral

| Norma / gobernanza | Programación |
|--------------------|--------------|
| Categoría funcional organiza módulos; permiso decide acceso | Instituva: `resolve_my_portal_modules`, `12_EMPLOYEE_PORTAL.md`, paquetes por categoría |
| Reglamento visible en portal según categoría | `portalCatalog.regulations` → `/mi-portal/reglamento` |
| Ponche según reglas de asistencia (BR-ATT en Museo docs) | Instituva: `attendance.clock`, RPC ponche; Museo: `employee-portal.html` (rama identidad). **Política `not_required` por empleado aún no en BD** (PROJECT_STATUS §5) |
| Áreas oficiales del museo (mantenimiento / ruta) | `MUSEO_ADMIN_V4_MASTER_SPEC.md` §10; módulos mantenimiento en ambos repos |

### 3.4 Colecciones, préstamos, finanzas

| Área | Estado respecto al reglamento |
|------|-------------------------------|
| Recibo/préstamo museográfico | `recibo-prestamo.html` + lógica en `app.js` |
| Finanzas / presupuesto | Modelo en `app.js` (conceptos); acceso `finance.read` |
| Colecciones patrimoniales | `02_COLLECTIONS_ARCHITECTURE.md` (no DELETE normal); Instituva categoría `collections` sin módulo propio aún |

---

## 4. Web Museo vs app Instituva (coherencia con reglamento)

| Tema | Museo_Admin_v4 (web) | Instituva_App | Riesgo normativo si divergen |
|------|----------------------|---------------|------------------------------|
| Reglamento PDF | Archivo estático en repo | Versionado + confirmación lectura | Distinta versión “vigente” |
| Renta / recibos MAG | Implementado (RPC museo prod) | Documentado en Dirección Ejecutiva; UI renta portal placeholder | Doble verdad de aprobaciones |
| Membresías + recibo MAG | Implementado | Criterio aceptación §14.9 | Misma organización debe compartir reglas |
| Menú / dashboard | Tarjetas fijas; sidebar sin categoría | `/mi-portal` por categoría + permisos | Empleado ve módulos distintos según canal |
| Login / identidad | RBAC museo (`hasPermission`) | Categoría + RBAC organización | Mismo empleado, distintos menús |

**Principio acordado (paso 1):** reglas municipales y del reglamento son **únicas**; los canales (web legacy + app) deben **converger** en un Supabase Instituva por entorno, sin eliminar el dashboard web hasta migrar módulo por módulo.

---

## 5. Matriz de verificación (julio 2026)

Leyenda: **OK** = trazable y coherente en repo; **Parcial** = falta BD, UI o un solo canal; **Doc** = solo documentado; **Gap** = no alineado.

| Regla / tema | Museo web | Instituva app | Gobernanza escrita |
|--------------|-----------|---------------|-------------------|
| PDF reglamento consultable | OK | Parcial (sin publicar PDF en org) | OK |
| Confirmación lectura reglamento | Gap | Parcial (RPC listo) | OK |
| Renta: textos MAG en solicitud | OK | Doc / placeholder | OK |
| Renta: recibo único + no aprobar sin recibo | OK (SQL aplicado prod museo) | Doc (DE + criterios) | OK |
| Fianza vs renta separadas; MAG custodia | Parcial UI | Doc | OK |
| Membresía: recibo MAG activación | OK | Doc | OK |
| Categorías → módulos portal | Gap | OK | OK |
| Dirección Ejecutiva bandeja | UI nativa conectada por puente seguro | UI móvil independiente + backend 0039 | OK |
| Autoaprobación prohibida | Parcial | Doc + diseño DE | OK |
| Asistencia / ponche por política reglamento | Parcial | Parcial (paquete categoría) | Doc (BR-ATT) |

---

## 6. Lista de cambios propuestos (solo backend / datos — UI congelada)

Ver **`docs/REGLAMENTO_ARTICULO_A_REGLAS.md` §I** y **`docs/POLITICA_UI_CONGELADA.md`**.

### Fase A — Una sola verdad normativa (sin tocar pantallas)

1. Publicar reglamento vigente en `organization_regulations` (Instituva) — **mismo PDF**, misma experiencia “Ver / Confirmar” en app.
2. Mantener y completar **`docs/REGLAMENTO_ARTICULO_A_REGLAS.md`** (columna Artículo PDF cotejada con el PDF).
3. ~~Cambiar enlaces o layout en `reglamento.html`~~ — **no** salvo autorización explícita.

### Fase B — Coherencia de datos (no reorganizar módulos)

4. ~~Filtrar tarjetas/sidebar Museo~~ — **retirado** (congelación UI).
5. Procedimiento operativo RRHH: categoría Instituva + rol alimentan **mismos permisos en servidor**; la grilla visible no cambia.
6. Sincronización de tenant Supabase; la app y la web siguen leyendo las mismas respuestas de API.

### Fase C — Reglamento municipal en servidor

7. Portar `rental_approval_controls` y membresías a Instituva (`organization_id`) — **mismas reglas y mensajes**.
8. Pruebas funcionales renta/membresías/DE sin alterar copy UI.
9. Bandeja Dirección Ejecutiva: integración origen ↔ caso en backend.

### Fase D — Asistencia

10. Política de asistencia en BD — **sin** mover tarjeta Ponchar ni paquetes de categoría visibles.

### Fase E — Gobernanza

11. PR checklist: reglamento + **¿tocó UI?** → requiere autorización.
12. Anexo artículo ↔ código actualizado cuando cambie **solo** backend.

### ~~Fase B anterior (UI)~~ — no aplicar

- Redirigir empleados, reordenar portal, filtrar dashboard: **prohibido** bajo política congelada.

---

## 7. Qué no hacer (protege tu trabajo)

- No eliminar `dashboard.html` ni módulos HTML hasta paridad **backend** (datos/reglas), no de pantallas.
- No aprobar renta/membresía solo en cliente sin RPC/RLS.
- No duplicar reglas de fianza/canon con números distintos a `defaultRentalSpaces` / `rentalGeneralRules`.
- No mezclar Supabase museo-prod con instituva-development para datos reales sin plan de migración.
- **No cambiar estética, orden de módulos, tarjetas del portal ni flujos** (`POLITICA_UI_CONGELADA.md`).

---

## 8. Referencias cruzadas

| Documento |
|-----------|
| `docs/POLITICA_UI_CONGELADA.md` |
| `docs/REGLAMENTO_ARTICULO_A_REGLAS.md` |
| `pdf/reglamento-museo-musica.pdf` |
| `reglamento.html` |
| `js/app.js` (`rentalGeneralRules`, `defaultRentalSpaces`, membresías, rental RPC) |
| `docs/supabase-rental-approval-controls.sql` |
| `docs/supabase-membership-municipal-receipt.sql` |
| `Instituva_App/docs/architecture/13_EXECUTIVE_DIRECTION_MODULE.md` |
| `Instituva_App/docs/PROJECT_STATUS_AND_MODULE_ROADMAP.md` |
| `Instituva_App/docs/architecture/12_EMPLOYEE_PORTAL.md` |
| `docs/PASO_1_PLATAFORMA_UNICA.md` |

---

*Próximo paso recomendado:* integración **Dirección Ejecutiva** ↔ renta/socios (§H / §I pendiente DE). Ver `13_EXECUTIVE_DIRECTION_MODULE.md`.
