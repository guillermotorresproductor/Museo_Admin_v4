-- Estados de recepción requeridos para cargar el inventario práctico.
alter table public.inventory_items
  drop constraint inventory_items_condition_check,
  add constraint inventory_items_condition_check
    check (condition in ('excelente','buena','regular','necesita_reparacion','fuera_de_servicio','por_verificar')),
  drop constraint inventory_items_status_check,
  add constraint inventory_items_status_check
    check (status in ('activo','en_reparacion','prestado','retirado','recibido'));
