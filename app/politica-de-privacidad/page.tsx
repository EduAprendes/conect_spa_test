import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad | Conect Spa",
  description: "Política de privacidad del asistente de Instagram de Conect Spa.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-sm leading-relaxed text-neutral-800">
      <h1 className="mb-2 text-2xl font-semibold text-neutral-900">
        Política de Privacidad
      </h1>
      <p className="mb-8 text-neutral-500">
        Última actualización: {new Date().toLocaleDateString("es-AR", { year: "numeric", month: "long", day: "numeric" })}
      </p>

      <p className="mb-6">
        Esta política de privacidad describe cómo Conect Spa ("nosotros")
        recibe, usa y protege la información cuando escribís a nuestra
        cuenta de Instagram.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold text-neutral-900">
        1. Qué información recibimos
      </h2>
      <p className="mb-6">
        Cuando nos enviás un mensaje directo por Instagram, recibimos el
        contenido de tu mensaje, tu identificador de usuario de Instagram y,
        si lo compartís durante la conversación, datos que vos mismo nos
        proporciones (por ejemplo, nombre, preferencias de turno, comprobantes
        de pago o datos de envío).
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold text-neutral-900">
        2. Cómo usamos esa información
      </h2>
      <p className="mb-6">
        Usamos esta información exclusivamente para responder tus consultas,
        gestionar turnos o pedidos, y brindarte atención al cliente. Parte de
        las respuestas se generan con un modelo de inteligencia artificial
        (Google Gemini), al que se le envía el texto de tu mensaje con el
        único fin de redactar una respuesta relevante — no se usa para
        entrenar modelos de terceros ni se comparte con fines publicitarios.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold text-neutral-900">
        3. Con quién compartimos información
      </h2>
      <p className="mb-6">
        No vendemos ni compartimos tu información con terceros para fines de
        marketing. La información pasa únicamente por los proveedores
        necesarios para prestar el servicio: Meta/Instagram (canal de
        mensajería) y Google (generación de respuestas mediante IA).
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold text-neutral-900">
        4. Cuánto tiempo conservamos la información
      </h2>
      <p className="mb-6">
        Conservamos el historial de conversación el tiempo necesario para
        brindarte atención y por motivos administrativos o legales
        razonables. Podés solicitar la eliminación de tus datos escribiéndonos
        a través del mismo canal de Instagram o al correo de contacto que
        figura abajo.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold text-neutral-900">
        5. Tus derechos
      </h2>
      <p className="mb-6">
        Podés pedirnos en cualquier momento acceder, corregir o eliminar la
        información que tenemos sobre vos, o dejar de recibir mensajes
        automatizados, contactándonos por los medios indicados abajo.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold text-neutral-900">
        6. Contacto
      </h2>
      <p className="mb-6">
        Ante cualquier consulta sobre esta política o sobre tus datos,
        escribinos a{" "}
        <a href="mailto:contacto@conectspa.com" className="underline">
          contacto@conectspa.com
        </a>{" "}
        o por Instagram directo a nuestra cuenta.
      </p>
    </main>
  );
}
