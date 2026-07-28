# Deployment and Environments

## Estado

BORRADOR APROBADO PARA REVISIÓN

## Objetivo

Definir la separación de dominios, ambientes y despliegues de Instituva sin mezclar la página pública con la aplicación administrativa.

## Dominios aprobados

Instituva utilizará una separación clara entre presencia pública y aplicación operacional.

- `instituva.com`: página pública y comercial.
- `app.instituva.com`: aplicación administrativa de Instituva.

`app.instituva.com` será la única aplicación instalable cuando se configure la PWA. El portal del empleado existirá como una experiencia por rol dentro de la misma aplicación, no como un subdominio ni como una PWA separada.

## Cloudflare Pages

Cloudflare Pages será el destino de despliegue para la página pública y para la aplicación administrativa, manteniendo proyectos y configuraciones separados.

La página pública y la aplicación administrativa deberán poder desplegarse de manera independiente, con ciclos de publicación separados y sin compartir secretos de ejecución.

## GoDaddy y DNS

GoDaddy podrá conservar inicialmente el registro del dominio. La administración DNS podrá residir en Cloudflare para facilitar TLS, protección, reglas de redirección y entrega global.

Antes de cambiar nameservers o registros DNS, deberá inventariarse la configuración existente, especialmente registros relacionados con correo institucional.

## Desarrollo local

El desarrollo local se realizará con variables de ambiente locales y sin datos reales de organizaciones. Cada desarrollador deberá trabajar contra entornos de prueba o datos ficticios autorizados.

## Staging

Staging será un ambiente separado de producción. Debe utilizar configuración, variables y base de datos independientes. Su objetivo es validar cambios antes de promoverlos a producción.

Staging no deberá exponerse a buscadores ni utilizar datos o secretos de producción.

## Producción

Producción será el ambiente utilizado por organizaciones reales. Cualquier cambio promovido a producción deberá haber pasado por revisión, pruebas y aprobación según el flujo de gobernanza del proyecto.

## Separación de Supabase por ambiente

Cada ambiente deberá utilizar su propio proyecto o configuración aislada de Supabase. La aplicación de Instituva no debe conectarse al Supabase operacional de ningún cliente existente.

Los entornos de desarrollo y staging deberán trabajar con datos ficticios o datos expresamente autorizados para prueba.

## Variables de ambiente

Las variables de ambiente deberán utilizarse para configurar cada despliegue. Los archivos reales de ambiente no deben versionarse.

El repositorio podrá incluir un archivo de ejemplo sin valores reales para documentar las variables requeridas.

## Proceso de despliegue

El despliegue deberá ser independiente por proyecto y por ambiente. La página pública y la aplicación administrativa podrán publicarse en momentos distintos.

Los cambios de dominio, DNS, autenticación, proveedores externos y despliegue deberán coordinarse para evitar interrupciones.

## Una sola PWA

La única PWA instalable será `app.instituva.com`. La experiencia administrativa, operativa y de empleados se resolverá dentro de la misma aplicación mediante organización activa, identidad, funciones institucionales, permisos y dispositivo.

## Restricciones

- No convertir `instituva.com` en PWA instalable.
- No crear una PWA separada para empleados.
- No crear un subdominio separado para el portal del empleado.
- No mezclar datos de staging con producción.
- No almacenar secretos en HTML, JavaScript público, capturas, chats o repositorios.