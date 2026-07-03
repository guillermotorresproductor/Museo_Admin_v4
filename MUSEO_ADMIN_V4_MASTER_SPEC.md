# MUSEO_ADMIN_V4_MASTER_SPEC
## Especificación Funcional Maestra
**Proyecto:** Sistema Administrativo del Museo de la Música de Puerto Rico  
**Cliente:** Guillermo Torres – Director del Museo

---

# 1. VISIÓN

El objetivo del proyecto es construir una plataforma administrativa integral para operar el Museo de la Música de Puerto Rico desde un único sistema web.

La primera versión será una aplicación HTML/CSS/JavaScript publicada en GitHub Pages.

La arquitectura deberá permitir migrar posteriormente a una base de datos sin rediseñar la interfaz.

---

# 2. PRINCIPIOS

- Diseño moderno.
- Interfaz sencilla.
- Máximo tres clics para llegar a cualquier módulo.
- Responsive.
- Código modular.
- Componentes reutilizables.

---

# 3. IDENTIDAD VISUAL

Usar exclusivamente:

images/logo-horizontal.jpg

Nunca modificar el logo.

Sidebar oscuro.

Tarjetas blancas.

Iconografía grande.

Inspiración:

- Microsoft 365
- Apple
- Notion

---

# 4. ESTRUCTURA

Dashboard

Login

Mi Cuenta

Empleados

Solicitud de Trabajo

Adiestramientos

Política de Empleados

Registro

Colecciones

Donaciones

Préstamos

Mantenimiento

Calendario de Obras

Solicitud de Materiales

Ruta Digital

Calendario

Renta de Espacios

Gift Shop

Boletería

Membresías

NAS

Administración

Boletín

Reportes

Finanzas

Notificaciones

Incidentes

Formularios

Reglamento

---

# 5. LOGIN

Administrador crea usuarios.

Cada empleado tendrá:

- Usuario
- Password
- Número automático de empleado
- Fotografía
- Nivel de acceso

Demo inicial

Usuario:

admin

Password:

123456

---

# 6. MI CUENTA

Cada empleado visualizará:

Nombre

Foto

Dirección

Teléfono

Correo

Número empleado

Departamento

Puesto

Fecha ingreso

Cambio contraseña

---

# 7. RECURSOS HUMANOS

Solicitud de empleo:

Nombre

Dirección

Teléfono

Correo

Puesto solicitado

Experiencia

Resume PDF

Confirmación antes del envío.

Envío por correo al administrador.

---

# 8. REGISTRO

Tres categorías:

Equipos electrónicos

Memorabilia

Vitrinas

Cada registro contendrá:

Descripción

Ubicación

Fotografía

Número de sello

Valor

Estado

---

# 9. COLECCIONES

Inventario perpetuo.

Cada pieza tendrá:

Número

Descripción

Fotografía

Donante

Prestamista

FMV

Ubicación

Código QR

Historial

---

# 10. MANTENIMIENTO

Calendario de Obras.

Ruta Digital.

Solicitud de Materiales.

Indicadores rojo y verde.

Checklist obligatorio.

Historial automático.

Áreas oficiales del museo según reglamento.

---

# 11. RENTA DE ESPACIOS

Formulario oficial.

Impresión.

Correo.

Tarifas.

Reglas del reglamento.

Calendario.

Control de disponibilidad.

---

# 12. BOLETERÍA

Venta.

Recibos.

ATH.

Tarjeta.

Efectivo.

Cheque.

Cuadre.

---

# 13. MEMBRESÍAS

Individual

Familiar

Corporativa

Fundador

Benefactor

Renovaciones

---

# 14. ADMINISTRACIÓN

Tareas.

NAS.

Boletín.

Documentos.

Reportes.

Finanzas.

---

# 15. REGLAMENTO

El módulo "Reglamento" deberá incluir:

Texto completo.

PDF descargable.

Buscador.

Botón imprimir.

---

# 16. FASES

## Fase 4.0

Sistema HTML navegable.

## Fase 4.1

Persistencia local.

## Fase 4.2

Firebase o Supabase.

## Fase 5.0

Sistema multiusuario.

---

# 17. REGLAS PARA CODEX

- Nunca cambiar el diseño sin autorización.
- Nunca cambiar el logo.
- Mantener navegación consistente.
- Mantener código limpio.
- No duplicar componentes.
- Crear funciones reutilizables.
- Documentar el código.

---

# 18. OBJETIVO FINAL

Construir una plataforma administrativa profesional para el Museo de la Música de Puerto Rico que pueda evolucionar hacia un producto comercial reutilizable por otros museos.

Fin de la Especificación Maestra v4.0
