# Implementation Roadmap

## Objetivo

Definir el orden de implementación del proyecto Museo_Admin_v4, preservando la arquitectura existente y evitando reescrituras innecesarias.

## Fase 1 - Estabilización

Objetivo:

Trabajar sobre la implementación existente sin modificar la arquitectura de la base de datos.

Actividades:

- Documentar el estado real de Supabase.
- Identificar las diferencias entre el frontend y la base de datos.
- Evitar cambios estructurales innecesarios.
- Trabajar siempre mediante cambios pequeños y verificables.

## Fase 2 - Refactorización del Frontend

Objetivo:

Adaptar el frontend para utilizar correctamente la arquitectura ya existente en Supabase.

Actividades:

- Revisar el flujo de autenticación.
- Eliminar dependencias innecesarias de localStorage.
- Centralizar la obtención del usuario autenticado.
- Centralizar la obtención del perfil.
- Centralizar la obtención del rol.
- Revisar los permisos de acceso a cada módulo.
