# IT-2026-005 | Activación controlada del Wi-Fi de asistencia

## Resumen del mecanismo
No se identifica el nombre del Wi-Fi (SSID) desde el navegador. La prueba propuesta es la **IP pública de salida**, vista por el servicio Supabase detrás de Cloudflare, con `cf-connecting-ip`. Todos los hotspots que salen por un mismo router comparten normalmente esa IP. No se acepta IP, SSID ni hash declarado por el usuario.

**Límite:** Esto confirma una conexión que sale por el gateway autorizado, no presencia física inequívoca. También cubriría conexiones por cable, redes de invitados que compartan salida, proxies o VPN que utilicen ese gateway. Antes de habilitar, bloquear accesos VPN remotos y confirmar la topología. Si la IP del proveedor cambia, el Wi-Fi dejará de validar y los empleados usarán GPS.

## Resguardos
- La RPC de asistencia existente, con turnos, secuencia y autorizaciones, se conserva.
- La función `clock-employee-time` exige autenticación y permiso `time.clock`, primero; el hash de la IP pública se calcula dentro de Supabase y nunca se acepta del cliente.
- La configuración de producción sigue `geolocation`, radio 100 m y `allowed_wifi_hashes=[]`.
- Las banderas `museoEnvironments.production.attendanceWifi.enabled` y `staging.attendanceWifi.enabled` son `false`.
- No hay cambios de esquemas, nómina, permisos, RLS, horarios ni registros históricos.
- Solo si la respuesta es `WIFI_NOT_AVAILABLE`, la interfaz intenta GPS. En errores de ponche, timeout o red NO reintenta otro método (evita entradas duplicadas).

## Condiciones previas de activación
1. Confirmar que los puntos Wi-Fi usados por los empleados salen por una misma IP pública del museo, distinta de la red doméstica. Determinar si es fija o dinámica, y si una VPN remota puede utilizarla.
2. Verificar en el endpoint de staging que Supabase sobrescribe el encabezado `cf-connecting-ip` ante el envío de un valor arbitrario: nunca confiar en `x-forwarded-for`. No activar si no se demuestra.
3. Verificar con al menos dos teléfonos conectados al Wi-Fi del museo y uno desde datos móviles o red ajena.
4. Calcular SHA-256 del valor UTF-8 exacto `instituva-wifi-egress-v1|<museum_id>|<ip-publica-confirmada>`, donde `museum_id` es el del museo en el ambiente correspondiente. No almacenar IPs en la aplicación del empleado.
5. Configurar `attendance_settings.allowed_wifi_hashes` con solamente ese hash; cambiar `presence_validation_mode` de `geolocation` a `any`, sin tocar `presence_required=true`, radio de GPS ni demás valores.
6. Activar `attendanceWifi.enabled=true` **solo después** de un despliegue de la Edge Function validado, ensayo en staging y aprobación de Administración.
7. Validar entrada, almuerzo, regreso y salida mediante Wi-Fi y GPS; revisar errores, intentos y registros de auditoría.
8. Rollback: poner `attendanceWifi.enabled=false`, restaurar `presence_validation_mode='geolocation'` y limpiar `allowed_wifi_hashes`; GPS sigue habilitado.

## Comprobación SQL previa — solo lectura
```sql
SELECT museum_id,presence_required,presence_validation_mode,
       geofence_radius_meters,cardinality(allowed_wifi_hashes) AS wifi_hashes,version
FROM public.attendance_settings;
```

**No activar solo porque aparece una IP en logs**: se debe confirmar físicamente que corresponde a la salida institucional. No utilizar la IP de un teléfono personal fuera del museo.
