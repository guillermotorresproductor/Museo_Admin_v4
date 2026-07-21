# Integración segura con QuickBooks Online

## Estado

Preparada como frontera arquitectónica. No se conecta a Intuit hasta disponer de una aplicación registrada, credenciales y URI de retorno aprobada.

## Reglas obligatorias

- QuickBooks Online será la fuente contable oficial; Instituva conservará workflows administrativos y referencias de sincronización.
- OAuth 2.0 Authorization Code se ejecutará mediante Edge Functions.
- `client_secret`, access tokens y refresh tokens nunca estarán en HTML, JavaScript ni Git.
- Los secretos estáticos se almacenarán en Supabase Project Secrets.
- Los tokens por compañía se cifrarán del lado servidor y solo serán accesibles mediante funciones privilegiadas.
- Toda conexión, renovación, exportación y desconexión se asociará a `museum_id` y quedará auditada.
- `finance.read`, `finance.write` y `finance.export` continuarán separados de Administrador.
- El parámetro OAuth `state` será aleatorio, de un solo uso, con expiración y vinculado al usuario/museo iniciador.

## Edge Functions previstas

1. `quickbooks-authorize`: valida `finance.export`, crea `state` y devuelve la URL de autorización.
2. `quickbooks-callback`: valida `state`, intercambia el código en Intuit y almacena tokens cifrados.
3. `quickbooks-sync`: renueva tokens en servidor y transmite operaciones aprobadas.
4. `quickbooks-disconnect`: revoca/desactiva la conexión y registra auditoría.

## Datos requeridos antes de implementar

- Intuit `client_id` y `client_secret` configurados como secretos de Supabase.
- URI HTTPS definitiva de callback.
- Compañía sandbox de QuickBooks y su `realmId`.
- Mapeo contable aprobado: cuentas, categorías, impuestos, clientes/proveedores y reglas de reconciliación.
- Decisión de dirección de sincronización y resolución de conflictos.

## Prohibiciones

- No llamar a Intuit directamente desde el navegador.
- No incluir tokens en URL, `localStorage`, archivos CSV o registros de auditoría.
- No considerar una exportación CSV como confirmación de contabilización.
- No conceder Finanzas automáticamente a Administrador, Ejecutivo o Recursos Humanos.