// Catálogo de servicios de Conect Spa. Se inyecta en el system prompt de la
// IA (ver lib/ai.ts) para que responda con datos reales del negocio en vez
// de inventar tratamientos, beneficios o precios.
//
// Para actualizar: agregar/editar servicios acá, no hace falta tocar
// lib/ai.ts. Los precios están en "Ref" (referencia a Tasa Euro BCV) tal
// como los maneja el spa — la IA no debe inventar una conversión a otra
// moneda ni asumir el valor del día.

export const CATALOGO_SERVICIOS = `
## PDRN (Polidesoxirribonucleótido)
Derivado del ADN (de esperma de salmón) para regeneración de la piel y
cicatrización de heridas. Estimula la producción de colágeno y elastina,
mejora la elasticidad de la piel y promueve la regeneración celular.
Beneficios:
- Reduce arrugas y líneas finas; mejora textura y luminosidad de la piel.
- Estimula la cicatrización de heridas y reduce cicatrices (nuevas y antiguas).
- Mejora la hidratación de la piel.
Costo: Ref. 220 por sesión (1 vial), Tasa Euro BCV. Hay un precio especial
disponible — si el cliente pregunta, decile que consulte el precio especial
puntual con el staff, no inventes el monto.

## HIFU — Ultrasonido Focalizado de Alta Intensidad (Nivel 12)
Dispositivo aprobado por FDA, emite ondas ultrasónicas focales en ráfagas
cortas hasta capas profundas de la piel.
Indicado para:
- Levantamiento de la piel de la ceja.
- Combatir la flacidez, tensar la piel.
- Efecto lifting inmediato y progresivo en el tiempo.
- Reducir la papada (actúa sobre grasa localizada).
Duración del procedimiento: 45 minutos a 1 hora. No requiere reposo.
Frecuencia recomendada: 2-3 sesiones al año.
Áreas a tratar: rostro, cuello, o abdomen (zonas con flacidez).
Costo (Tasa Euro BCV, válido para todos los métodos de pago):
- Ref. 200 — sesión de rostro.
- Ref. 250 — sesión de rostro y cuello.
- Ref. 300 — sesión corporal.
`.trim();
