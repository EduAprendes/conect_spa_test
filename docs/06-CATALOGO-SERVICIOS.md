# Catálogo de servicios en el contexto de la IA

Para que la IA responda preguntas sobre tratamientos, beneficios y precios
con **datos reales del negocio** (y no inventados), la info del catálogo se
inyecta directo en el system prompt en cada respuesta.

## Por qué un archivo aparte y no texto suelto en el prompt

`lib/catalog.ts` exporta un solo string (`CATALOGO_SERVICIOS`) que
`lib/ai.ts` importa y pega dentro de `buildSystemPrompt()`. Separarlo así
permite que actualizar el catálogo (agregar un servicio, cambiar un precio)
sea editar un solo archivo de contenido, sin tocar la lógica de la IA ni el
tool-calling.

```ts
// lib/catalog.ts
export const CATALOGO_SERVICIOS = `
## Nombre del servicio
Descripción corta.
Beneficios:
- ...
Costo: ...
`.trim();
```

```ts
// lib/ai.ts
import { CATALOGO_SERVICIOS } from "./catalog";
// ...se interpola dentro del system prompt junto con una instrucción
// explícita de "no inventes servicios ni precios que no estén acá".
```

## De dónde salió el contenido (07-sep-2026)

Se cargó a partir de dos mensajes de WhatsApp del negocio (texto tal cual
lo pasó el cliente, reformateado a Markdown):

- **PDRN (Polidesoxirribonucleótido)** — regeneración de piel, derivado de
  ADN de esperma de salmón. Ref. 220 por sesión (1 vial), Tasa Euro BCV.
  Mencionaba un "precio especial" sin el monto — se le dijo a la IA que
  ante esa pregunta derive al staff en vez de inventar un número.
- **HIFU (Ultrasonido Focalizado de Alta Intensidad, Nivel 12)** —
  lifting/flacidez, aprobado por FDA. Precios distintos por zona: Ref. 200
  (rostro), Ref. 250 (rostro y cuello), Ref. 300 (corporal).

## Cómo agregar un servicio nuevo

1. Copiar el bloque de un servicio existente en `lib/catalog.ts` como
   plantilla.
2. Pegar la info tal como la mande el cliente (WhatsApp, PDF, lo que sea) y
   limpiarla a Markdown simple — no hace falta reescribirla de cero.
3. Si falta un dato (ej. un precio "a consultar"), decirle explícitamente a
   la IA qué hacer en ese caso (derivar al staff, no inventar) en vez de
   dejarlo ambiguo.
4. Probar con un mensaje directo tipo "¿qué es \<servicio\> y cuánto sale?"
   antes de dar por hecho que quedó bien enganchado — ver
   `03-GOOGLE-CALENDAR-IA.md` para cómo correr una prueba rápida contra
   `generateReply` en local sin pasar por Instagram.
