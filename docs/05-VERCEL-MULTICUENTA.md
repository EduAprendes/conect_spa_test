# Repo de GitHub y proyecto de Vercel en cuentas distintas

Escenario común: vos (el developer) armás el proyecto, pero el repo de
GitHub y/o el proyecto de Vercel terminan quedando bajo la cuenta del
**cliente** (ej. porque él lo creó siguiendo el wizard de GitHub/Vercel).
Esto generó varias fricciones en este proyecto — quedan documentadas para
no perder tiempo reconociéndolas de nuevo.

## Síntoma 1: Vercel bloquea el deploy automático

> "The deployment was blocked because the commit author did not have
> contributing access to the project on Vercel. The Hobby Plan does not
> support collaboration for private repositories."

**Causa:** el repo de GitHub es privado, el commit lo hizo un usuario de
GitHub que **no** es dueño del proyecto de Vercel, y el plan Hobby no
permite agregar colaboradores externos al proyecto de Vercel (eso requiere
plan Pro).

**Solución usada:** hacer el repo de GitHub **público** (el código no tenía
secretos — esos viven en `.env`, nunca se suben). Con el repo público, la
restricción de "Hobby no soporta colaboración en repos privados" deja de
aplicar. Alternativas si no se puede hacer público: subir a Vercel Pro, o
que los commits que disparan deploy salgan siempre de la cuenta dueña del
proyecto.

**Nota:** después de resolverlo, el deploy bloqueado **no se reintenta
solo** — hace falta un push nuevo (o un deploy manual) para disparar un
build fresco.

## Síntoma 2: el CLI de Vercel no encuentra el proyecto

```
vercel project inspect mi-proyecto
# {"status":"error","reason":"project_not_found", ...}
```

**Causa:** `vercel whoami` muestra tu cuenta, pero el proyecto pertenece a
la cuenta del cliente — no vas a verlo con `vercel project ls` ni vas a
poder leer sus env vars, aunque el repo de GitHub sí sea "tuyo" (son
sistemas de permisos separados: acceso a GitHub ≠ acceso al proyecto de
Vercel).

**Solución:** `vercel login` para autenticarte en el CLI **como la cuenta
dueña del proyecto** (flujo por navegador — el CLI te da una URL +
código de un solo uso para confirmar). Esto desloguea tu cuenta anterior en
esta sesión de CLI local hasta que vuelvas a loguearte vos. Después:

```bash
vercel link --project <nombre-del-proyecto>
vercel env pull .env.local --environment=production
```

## Truco útil: deploy directo por CLI en vez de por git push

Una vez logueado como la cuenta dueña del proyecto, `vercel --prod --yes`
**deployea directo, sin pasar por el trigger de git** — evita por completo
el síntoma 1 (la restricción es específica de deploys disparados por push a
GitHub, no de deploys manuales por CLI). Útil para iterar rápido sin tener
que resolver el tema de las cuentas cada vez.

## Cargar env vars por CLI sin exponerlas en el historial de shell

```bash
# Valores simples:
vercel env add NOMBRE production --value "valor" --yes

# Ojo con valores que empiezan con "-" (ej. un offset "-04:00"):
vercel env add BUSINESS_UTC_OFFSET production --value="-04:00" --yes   # con "=", no espacio

# Valores largos/con saltos de línea (ej. una private key):
cat archivo.txt | vercel env add NOMBRE production --yes
```

Repetir para cada `environment` (`production`, `preview`) — el comando no
acepta varios a la vez.

## Chequeo rápido antes de asumir que "no anda"

Antes de suponer que un endpoint no funciona, probar el handshake/deploy
actual primero — varias veces el problema real terminó siendo "estás
mirando la cuenta/proyecto equivocado", no un bug de código:

```bash
vercel whoami                          # ¿con qué cuenta está el CLI?
vercel project inspect <nombre>        # ¿esta cuenta ve el proyecto?
vercel env ls                          # ¿qué variables tiene realmente el proyecto?
```
