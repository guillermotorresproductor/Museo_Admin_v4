# Anexo: Reglamento → reglas → implementación (UI congelada)

**PDF oficial:** `pdf/reglamento-museo-musica.pdf`  
**Política UI:** `docs/POLITICA_UI_CONGELADA.md` — **no mover módulos, diseño ni flujos visibles.**

**Cómo usar este anexo:** la columna **Artículo PDF** se completa al cotejar con el PDF (número de artículo o sección). Las reglas **R-01…R-10** ya están transcritas desde la programación (`rentalGeneralRules`); deben correlacionarse con el artículo exacto del reglamento cuando el equipo haga la lectura lado a lado.

---

## A. Renta de espacios — reglas generales (texto en UI, congelado)

| ID | Artículo PDF *(completar)* | Texto / regla en sistema | UI (no cambiar) | Backend (optimizar permitido) |
|----|---------------------------|--------------------------|-----------------|-------------------------------|
| R-01 | Art. XIV — aprobación previa del MAG y formalización documental, p. 14; Art. XV — solicitud escrita, pp. 17–18 | Aprobación previa MAG; documento formal | `rentalGeneralRules[0]` en solicitud renta | Validación en RPC aprobación |
| R-02 | Art. XIV — compatibilidad con fines culturales, educativos e institucionales, p. 15; Art. XVI — prohibición político-partidista, p. 19 | Fines culturales/educativos; no político-partidista | `rentalGeneralRules[1]` | Mismo texto; flag interno si aplica |
| R-03 | Art. XV — identificación con foto o resolución corporativa, p. 18 | ID foto o resolución corporativa | `rentalGeneralRules[2]` | Campos solicitud + auditoría |
| R-04 | Art. XV — póliza de responsabilidad pública o programa de seguros del MAG, pp. 18–19 | Póliza responsabilidad pública / programa MAG | `rentalGeneralRules[3]` | Evidencia documental en expediente |
| R-05 | Art. XV — pago previo en Recaudaciones del MAG y evidencia antes de la actividad, p. 18 | Pago antes de actividad; evidencia antes del uso | `rentalGeneralRules[4]` | Recibo MAG obligatorio salvo prod. interna |
| R-06 | Art. XVI — coordinación previa de equipos, decoración, montaje y escenografía, pp. 19–20 | Montaje/decoración informados y coordinados | `rentalGeneralRules[5]` | |
| R-07 | Art. XVI — prohibición de alterar estructuras, superficies, paredes, pisos, techos, pintura o elementos permanentes, p. 19 | No alterar paredes/pisos/elementos permanentes | `rentalGeneralRules[6]` | |
| R-08 | Art. XVI — entrega en orden y limpieza; responsabilidad y reembolso por daños, p. 19 | Orden, limpieza, responsabilidad por daños | `rentalGeneralRules[7]` | Fianza / disposición DE (Instituva 0039) |
| R-09 | Art. XVI — responsabilidad por orden, comportamiento y normas de participantes, invitados, empleados y contratistas; conducta y seguridad, pp. 19–20 | Conducta y seguridad de invitados/contratistas | `rentalGeneralRules[8]` | |
| R-10 | Art. XIV — facultad del MAG para revocar, suspender o modificar autorizaciones, p. 15 | MAG puede revocar/suspender/modificar | `rentalGeneralRules[9]` | Estados expediente + auditoría |

**Archivos UI congelados:** `solicitud-renta.html`, `renta-espacios.html`, `renta-espacio.html`, `js/app.js` (copy de reglas y fichas).

---

## B. Renta — tarifas y fianzas por espacio (datos congelados en copy)

| Espacio (`id`) | Nombre reglamentario | Canon / fianza (código) | Notas reglamento en `requirements` |
|----------------|---------------------|-------------------------|-------------------------------------|
| `ballroom` | Ballroom | 1000 / 500 | Salón Lito Peña |
| `mezzanine` | Mezzanine | 1000 / 500 | |
| `cine-bienvenida` | Espacio audiovisual | 600 / 300 | |
| `lobby` | Vestíbulo (Lobby) | 600 / 300 | |
| `plazoleta` | Plazoleta | 600 / 300 | |
| `salon-adiestramiento` | Salón de Adiestramiento | 300 / 50 evento completo; $40/h min 2h; **sin fianza por horas** | Ver `requirements[]` en `app.js` |
| `anfiteatro` | Anfiteatro | 1000 / 500 | |
| `estacionamiento` | Estacionamiento | 2500 / 500 | |

**Backend permitido:** mover estos valores a tablas Supabase **manteniendo los mismos números y textos** servidos a la UI; no cambiar redacción visible sin autorización.

---

## C. Recibos municipales (MAG / Guaynabo) — decisiones §9 Instituva

| Regla | Artículo PDF *(completar)* | Comportamiento usuario (congelado) | Implementación servidor |
|-------|---------------------------|-----------------------------------|-------------------------|
| Renta: no aprobar sin recibo | Art. XV — pago previo en Recaudaciones del MAG y presentación de evidencia antes de la actividad, p. 18 | Admin ingresa recibo MAG; no aprueba sin él | Museo: `docs/supabase-rental-approval-controls.sql`. Instituva: `0041_rental_municipal_approval_controls.sql` (`organization_id`) |
| Recibo único por museo | No localizado en PDF — control interno de Instituva (§9) | Mensaje error si duplicado | Museo: `rental_receipt_unique_per_museum_idx`. Instituva: `rental_receipt_unique_per_organization_idx` |
| Producción interna exenta | No localizado en PDF — decisión interna §9. El Art. XV, p. 19, solo faculta al Alcalde a eximir canones o tarifas en determinados casos | Toggle/check prod. interna; canon/fianza $0 | `internal_production` en RPC |
| Renta + fianza = dos pagos, dos recibos | No localizado en PDF — el Art. XIV, p. 15, permite depósitos y fianzas, pero no exige dos pagos ni dos recibos | Copy y flujo DE (futuro bandeja) | `13_EXECUTIVE_DIRECTION_MODULE.md` §8.2 |
| MAG custodia fianza; ArteGrafiko no custodia | No localizado en PDF — ver ordenanza, resolución o directriz financiera del MAG | Solo documentación / DE | Gobernanza; no UI de “cobro” ArteGrafiko |
| Membresía: recibo antes de activar | No localizado en PDF — Art. XXI, p. 23, autoriza el programa y sus aportaciones, pero no establece recibo previo a la activación; decisión interna §9 | Campo recibo Guaynabo; cortesía exenta | Museo: CHECK `museum_members_paid_activation_receipt_check`. Instituva: `0044_patron_memberships_municipal_controls.sql` |
| Membresía: aprobación ejecutiva final | No localizado en PDF para cada membresía — Art. XXI, p. 23, exige aprobación del MAG para implantar categorías, beneficios, requisitos y aportaciones | Flujo RH + DE | Instituva criterios §14.9 |

---

## D. Reglamento del museo — consulta y cumplimiento

| Regla | Artículo PDF *(completar)* | UI congelada | Backend permitido |
|-------|---------------------------|--------------|-------------------|
| Texto/PDF oficial disponible | Arts. I y III — título y propósito del Reglamento, pp. 1–2 | Web: `reglamento.html` + PDF estático | Instituva: `0042_register_organization_regulation.sql` + `scripts/publish-museum-regulation.ps1` (subida PDF + RPC; operación pendiente en staging) |
| Empleado puede consultar según categoría | No localizado en PDF — mecanismo interno de acceso documental de Instituva | App: tarjeta **Reglamento del museo** (orden fijo en paquete) | `regulations.read`; `0033_documents_and_regulations.sql` |
| Confirmación de lectura | No localizado en PDF — control interno de cumplimiento y auditoría de Instituva | Botones “Ver” / “Confirmar lectura” en app | `acknowledge_regulation()` + auditoría |
| No sustituir trámite municipal por aprobación interna | Art. XIV — aprobación previa del MAG y formalización correspondiente, p. 14; Art. XV — solicitud y aprobación por los canales establecidos, pp. 17–18 | Copy en gobernanza DE | Criterio aceptación 10 |

---

## E. Portal por categoría — módulos y orden (NO reordenar)

Fuente: `Instituva_App/docs/architecture/12_EMPLOYEE_PORTAL.md` + `portalCatalog.tsx` (`displayOrder`).  
La resolución real: `resolve_my_portal_modules` ∩ permisos. **No cambiar códigos, rutas ni orden de tarjetas** salvo autorización.

### Categoría `administration` (Administración — ejecutivos/administradores regulares)

Paquete candidato (orden de negocio): Reportes → RR. HH. → Calendarios → Finanzas → Renta de espacios → Boletín → Reglamento.  
*(Dirección Ejecutiva: módulo `executive_direction`, permiso `executive.case.read`, ruta `/administracion/direccion-ejecutiva` — visible cuando categoría + permiso lo incluyen; sin Ponchar en paquete.)*

### Categoría `finance`

Mismo paquete inicial que Administración; RR. HH. desaparece sin `employee.read_all`.

### Categoría `operations`

Ponchar → Turnos → Nómina → Documentos → Calendario general → Renta → Boletín → Reglamento.

### Categoría `human_resources`

RR. HH. → Calendarios → Boletín → Reglamento.

### Categoría `maintenance`

Ponchar → Calendario obras → Materiales → Ruta digital → Nómina → Documentos → Reglamento.

### Categorías `general_employee`, `ushers`, `collections`, `education_programming`

Ponchar → Turnos → Nómina → Documentos → Calendario general → Boletín → Reglamento.

**Cerrar sesión:** siempre última tarjeta (acción local, sin permiso).

**Web Museo `dashboard.html`:** tarjetas legacy (calendario, renta, membresías, etc.) — **congeladas**; convergencia de datos por backend, no rediseño.

---

## F. Roles: empleado regular / ejecutivo / administrador (lógica congelada)

| Actor | Experiencia congelada | Autoridad real (backend) |
|-------|----------------------|---------------------------|
| Empleado regular | `/mi-portal` según categoría (p. ej. operaciones → Ponchar) | Permisos + RLS; categoría no concede permiso |
| Ejecutivo / administrador (categoría Administración) | Grilla administrativa sin Ponchar; acceso DE si `executive.case.read` | Mismo; MPR-000002 documentado en PROJECT_STATUS |
| RH | Paquete RRHH + permisos expedientes | `employee.read_all`, etc. |
| Finanzas | Paquete tipo administración filtrado por `finance.read` | Sin herencia médica/finanzas automática (matriz roles) |

**Instituva `/` (DashboardPage):** panel desktop adicional; no sustituye `/mi-portal` móvil. **No fusionar pantallas.**

**Museo HTML:** login → `dashboard.html` o portal según permisos en `postLoginDestination` — **no cambiar rutas visibles.**

---

## G. Asistencia (reglamento laboral + BR-ATT)

| Tema | Artículo PDF *(completar)* | UI congelada | Backend pendiente permitido |
|------|---------------------------|--------------|----------------------------|
| Secuencia ponche | BR-ATT en Museo docs | Botón Ponchar en app; portal HTML museo (rama identidad) | RPC `clock_employee_attendance` |
| Permiso `time.clock` / `attendance.clock` | No localizado en PDF — control técnico interno de Instituva | Módulo solo si paquete + permiso | RLS |
| Administración sin tarjeta Ponchar | No localizado en PDF — política interna de portal; el Reglamento no establece reglas de ponche o asistencia | Por paquete categoría (hoy) | `0047`: `default_attendance_policy` + `resolve_my_portal_modules` / RPC |

---

## H. Dirección Ejecutiva

| Regla gobernanza | UI congelada | Backend |
|------------------|--------------|---------|
| No autoaprobación | Bandeja DE, acciones aprobar/rechazar/devolver | `executive_cases`, 0039 |
| Renta/membresía/compras pasan por DE | Tarjeta módulo + rutas existentes | `0048`: `rental_space_requests`, prepare/ensure RPC, efectos al aprobar |
| Auditoría append-only | | `audit_logs`, triggers |

---

## I. Lista de trabajo solo backend (alineada a reglamento)

1. Publicar PDF vigente en `organization_regulations` (bytes idénticos al repo Museo). — *Ejecutar `publish-museum-regulation.ps1` en staging (0043 + storage).*
2. Portar RPC renta/membresía a esquema Instituva con **mismas reglas**, mismos mensajes de error en español. — *Renta: `0041`; membresía: `0044` (+ RPC recibo/estado).*
3. Un Supabase operacional Instituva por entorno; migración de datos planificada, **sin** retirar HTML. — *Ver `Instituva_App/docs/SUPABASE_ENVIRONMENTS_AND_DATA_MIGRATION.md`, `0045`, `config/supabase-environments.json`.*
4. Índices y RPC optimizados; Edge Functions idempotentes. — *`0046`; ver `Instituva_App/docs/BACKEND_RPC_AND_EDGE_IDEMPOTENCY.md`.*
5. Completar columna **Artículo PDF** en tablas A–G cotejando con `reglamento-museo-musica.pdf`.
6. Política de asistencia en BD cuando exista — **sin** mover módulo Ponchar en UI. — *`0047`; `BACKEND_ATTENDANCE_POLICY.md`.*

**Explícitamente fuera de alcance:** filtrar sidebar Museo, reordenar `portalCatalog`, rediseñar dashboard, unificar pantallas app/web.

---

## J. Control de cambios

| Fecha | Cambio en anexo | ¿Tocó UI? |
|-------|-----------------|-----------|
| 2026-07-28 | Creación inicial desde código y gobernanza | No |
| 2026-07-28 | Cotejo documental con PDF oficial: referencias completadas en tablas A, C, D y G; reglas sin fundamento expreso marcadas como no localizadas | No |
| 2026-07-28 | Backend Instituva: `0041` controles renta MAG; `0042` publicación reglamento; script `publish-museum-regulation.ps1` | No |
| 2026-07-28 | Fase A: `0043` RPC service_role; script sube PDF + registra versión activa (ejecutar en staging) | No |
| 2026-07-28 | §I.2: `0044` dominio socios (`museum_members`), recibo MAG, RPC alineados a Museo | No |
| 2026-07-28 | §I.3: registro entornos, plan migración, `0045` puente legacy_museum_id, scripts `scripts/migration/` | No |
| 2026-07-28 | §I.4: `0046` índices, RPC idempotentes, idempotency Edge upload documentos | No |
| 2026-07-28 | §I.6: `0047` política asistencia (`not_required` administración/finanzas), portal + RPC | No |
| 2026-07-28 | DE ↔ renta/socios: `0048` casos ejecutivos, prepare, gates y efectos al aprobar | No |
