# Frontera: Inventario de Equipos vs Colecciones Museográficas

Estado: Aprobada  
Fecha: 2026-07-31  
ADR relacionada: ADR-011

## 1. Decisión

El sistema mantiene dos dominios completamente separados:

| Dominio | Responsabilidad |
|---|---|
| **Inventario de Equipos** | Activos operacionales del museo |
| **Colecciones Museográficas** | Objetos culturales bajo custodia |

No comparten fichas maestras, numeración, estados ni flujos.

## 2. Inventario de Equipos

Administra activos operacionales, por ejemplo:

- computadoras, proyectores, pantallas;
- equipos de audio e iluminación;
- herramientas y mobiliario;
- equipos de mantenimiento;
- números de activo y serie;
- ubicación y responsable;
- condición, garantía, mantenimiento y baja operacional.

Ruta actual: `inventario.html`  
Navegación: módulo administrativo independiente (no forma parte del Departamento Museológico).

## 3. Colecciones Museográficas

Administra objetos culturales bajo custodia, por ejemplo:

- piezas propias, donaciones, préstamos y depósitos;
- procedencia, titularidad, condición y conservación;
- ubicación museográfica;
- fotografías y documentos;
- seguro, movimientos, exhibiciones;
- devolución o baja museográfica.

Acceso vigente: tarjeta **Colecciones Museográficas** en `departamento-museologico.html` (próximamente como ficha maestra).  
Los **Formularios Museográficos** (`recibo-prestamo.html` y relacionados) inician procesos; Colecciones conserva la ficha maestra y el historial.

## 4. Regla de clasificación

- Un instrumento musical **museográfico** pertenece a **Colecciones**.
- Un instrumento, amplificador o micrófono usado **operacionalmente** pertenece a **Inventario de Equipos**.
- Los formularios museográficos alimentan **Colecciones**, no Inventario de Equipos.

## 5. Estado de la implementación actual

`inventario.html` + `bindInventoryModule()` en `js/app.js` mezclaban históricamente equipos y “Obra de Arte”.

Separación aplicada en esta fase (sin migración de datos ni cambios Supabase):

- La UI y la navegación presentan solo **Inventario de Equipos**.
- Se bloquea el alta de nuevos registros tipo `Obra de Arte`.
- Se conservan campos y lógica legacy de obras para consultar/editar registros históricos ya guardados en `app_records` (`módulo: inventario`, `clave: records`) hasta una migración futura aprobada hacia Colecciones.
- No existe módulo vigente llamado “Inventario de piezas”. Esa expresión no debe usarse en la interfaz.

## 6. Principios

- Inventario de Equipos nunca administra patrimonio cultural.
- Colecciones nunca administra activos operacionales como ficha maestra.
- No se mueven tablas ni datos sin migración aprobada.
- No se eliminan rutas ni archivos; solo se separa el acceso semántico.
