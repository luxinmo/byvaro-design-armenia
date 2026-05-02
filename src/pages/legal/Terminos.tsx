/**
 * Pantalla pública · Términos y Condiciones (`/legal/terminos`).
 *
 * Documento legal vinculante que el usuario acepta en el registro
 * (checkbox obligatorio en `/register` step 2). El snapshot
 * `{ version, acceptedAt }` se guarda en `user_profiles.metadata.terms_accepted`
 * vía el trigger `handle_new_user_signup`.
 *
 * Para modificar los términos, edita este archivo y bumpea
 * `LEGAL_VERSION` en `src/lib/legalVersion.ts`.
 */

import { LEGAL_UPDATED_AT, LEGAL_VERSION } from "@/lib/legalVersion";
import { LegalLayout } from "./LegalLayout";

export default function Terminos() {
  return (
    <LegalLayout
      title="Términos y Condiciones de Uso"
      version={LEGAL_VERSION}
      updatedAt={LEGAL_UPDATED_AT}
    >
      <p>
        Estos Términos y Condiciones (en adelante, los <strong>"Términos"</strong>)
        regulan el acceso y uso de la plataforma <strong>Byvaro</strong> (en adelante,
        el <strong>"Servicio"</strong>) ofrecida a través del sitio web{" "}
        <a href="https://byvaro.com">byvaro.com</a> y sus subdominios. Al registrarte,
        acceder o utilizar el Servicio aceptas estos Términos íntegramente. Si no estás
        de acuerdo, no debes utilizar el Servicio.
      </p>

      <h2>1. Identificación del prestador</h2>
      <p>
        El Servicio es prestado por <strong>Byvaro</strong>, con domicilio en España y
        contacto a través de <a href="mailto:legal@byvaro.com">legal@byvaro.com</a>.
        Los datos identificativos completos están disponibles en el aviso legal del
        sitio web.
      </p>

      <h2>2. Descripción del Servicio</h2>
      <p>
        Byvaro es una plataforma SaaS dirigida a profesionales del sector inmobiliario
        (promotores, comercializadores y agencias) que permite gestionar promociones de
        obra nueva, contactos, registros de clientes, colaboraciones inter-empresa,
        documentos contractuales y comunicaciones. El Servicio se presta tal cual y
        puede evolucionar funcionalmente sin previo aviso.
      </p>

      <h2>3. Registro y cuenta de usuario</h2>
      <p>
        Para utilizar el Servicio debes:
      </p>
      <ul>
        <li>Tener al menos 18 años y capacidad legal para contratar.</li>
        <li>
          Proporcionar datos veraces, completos y actualizados en el formulario de
          registro (nombre, email profesional, teléfono y empresa).
        </li>
        <li>
          Confirmar tu email mediante el enlace que recibirás tras el alta. Hasta que
          no confirmes el email, tu cuenta permanece inactiva.
        </li>
        <li>
          Mantener la confidencialidad de tus credenciales. Eres responsable de
          cualquier actividad realizada bajo tu cuenta.
        </li>
      </ul>
      <p>
        Si detectas un acceso no autorizado, contacta inmediatamente con{" "}
        <a href="mailto:soporte@byvaro.com">soporte@byvaro.com</a>.
      </p>

      <h2>4. Modelo de negocio y planes</h2>
      <p>
        El Servicio opera bajo dos modalidades:
      </p>
      <ul>
        <li>
          <strong>Promotor / Comercializador.</strong> Plan de pago por suscripción
          mensual postpago, sin permanencia. Las tarifas vigentes se muestran en{" "}
          <a href="https://byvaro.com/precios">byvaro.com/precios</a>.
        </li>
        <li>
          <strong>Agencia colaboradora.</strong> Acceso gratuito en su Fase 1 cuando
          ha sido invitada por un promotor. El uso del marketplace público podrá
          requerir una suscripción independiente cuando esté disponible.
        </li>
      </ul>
      <p>
        Los pagos se procesan a través de un proveedor externo (Stripe). Byvaro
        emitirá factura electrónica conforme a la legislación aplicable. El cliente
        puede cancelar la suscripción en cualquier momento desde el panel de
        facturación; la cancelación surte efecto al final del periodo facturado en
        curso.
      </p>

      <h2>5. Uso aceptable</h2>
      <p>
        Te comprometes a usar el Servicio únicamente para fines profesionales lícitos
        relacionados con tu actividad inmobiliaria. Queda expresamente prohibido:
      </p>
      <ul>
        <li>
          Subir, almacenar o transmitir contenido ilegal, infractor de derechos de
          terceros, difamatorio, fraudulento o que vulnere la privacidad de personas
          identificables sin su consentimiento.
        </li>
        <li>
          Utilizar el Servicio para enviar comunicaciones comerciales no solicitadas
          (spam) o realizar prácticas de scraping no autorizadas.
        </li>
        <li>
          Intentar acceder a datos de otros usuarios o tenants, eludir las medidas de
          seguridad o realizar ingeniería inversa del Servicio.
        </li>
        <li>
          Revender, sublicenciar o ceder el acceso al Servicio a terceros sin
          autorización expresa de Byvaro.
        </li>
      </ul>
      <p>
        Byvaro se reserva el derecho a suspender o cancelar cuentas que infrinjan
        estos Términos, sin perjuicio del ejercicio de las acciones legales que
        correspondan.
      </p>

      <h2>6. Datos del cliente y propiedad</h2>
      <p>
        Conservas todos los derechos sobre los datos que introduces en el Servicio
        (contactos, promociones, documentos, comunicaciones). Byvaro actúa como
        encargado del tratamiento conforme al RGPD para los datos personales de
        terceros que tú gestionas. Los detalles del tratamiento están en la{" "}
        <a href="/legal/privacidad">Política de Privacidad</a>.
      </p>
      <p>
        Byvaro almacena tus datos en infraestructura europea (Supabase · región AWS
        eu-west-1) y mantiene copias de seguridad cifradas. En caso de baja, podrás
        exportar tus datos durante 30 días desde la cancelación; transcurrido ese
        plazo se eliminarán de forma segura.
      </p>

      <h2>7. Propiedad intelectual de Byvaro</h2>
      <p>
        El Servicio, su código, diseño, marca, logotipos y documentación son
        propiedad exclusiva de Byvaro y están protegidos por la legislación de
        propiedad intelectual e industrial. Te concedemos una licencia personal,
        no exclusiva, no transferible y revocable para usar el Servicio mientras
        mantengas tu cuenta activa.
      </p>

      <h2>8. Disponibilidad y soporte</h2>
      <p>
        Byvaro pone los medios razonables para garantizar una disponibilidad
        continuada del Servicio. No obstante, no se garantiza la ausencia total de
        interrupciones derivadas de mantenimiento, actualizaciones, ataques externos
        o causas de fuerza mayor. El soporte se presta por email
        (<a href="mailto:soporte@byvaro.com">soporte@byvaro.com</a>) en horario
        laboral en días hábiles peninsulares.
      </p>

      <h2>9. Limitación de responsabilidad</h2>
      <p>
        En la máxima medida permitida por la ley, la responsabilidad total de
        Byvaro frente al usuario por cualquier reclamación derivada del Servicio
        queda limitada al importe efectivamente abonado por dicho usuario en los
        12 meses anteriores al hecho generador de la reclamación. Byvaro no
        responderá de:
      </p>
      <ul>
        <li>
          Daños indirectos, lucro cesante, pérdida de oportunidad o pérdida de
          datos derivada de uso inadecuado del Servicio.
        </li>
        <li>
          Decisiones comerciales que tomes en base a información del Servicio
          (incluyendo recomendaciones algorítmicas, detección de duplicados o
          análisis de IA).
        </li>
        <li>
          Conflictos contractuales entre tú y otros usuarios del Servicio
          (por ejemplo, promotor y agencia colaboradora).
        </li>
      </ul>

      <h2>10. Modificaciones de los Términos</h2>
      <p>
        Byvaro podrá modificar estos Términos para adaptarlos a cambios legales,
        funcionales o de modelo de negocio. Los cambios sustanciales se
        notificarán por email con al menos 15 días de antelación a su entrada en
        vigor. El uso continuado del Servicio tras dicho periodo implica
        aceptación de los nuevos Términos. Si no estás de acuerdo, podrás cancelar
        tu cuenta sin coste.
      </p>

      <h2>11. Terminación</h2>
      <p>
        Puedes cancelar tu cuenta en cualquier momento desde los ajustes. Byvaro
        podrá resolver el contrato de forma anticipada en caso de incumplimiento
        grave por tu parte (impago, uso fraudulento, vulneración de derechos de
        terceros), notificándolo por email.
      </p>

      <h2>12. Ley aplicable y jurisdicción</h2>
      <p>
        Estos Términos se rigen por la legislación española. Cualquier
        controversia derivada de su interpretación o ejecución se someterá a los
        Juzgados y Tribunales del domicilio del consumidor cuando el usuario
        actúe como tal, o a los Juzgados y Tribunales de la ciudad donde Byvaro
        tenga su sede social en el resto de casos, salvo lo dispuesto por
        normas imperativas.
      </p>

      <h2>13. Contacto</h2>
      <p>
        Para cualquier consulta sobre estos Términos puedes escribir a{" "}
        <a href="mailto:legal@byvaro.com">legal@byvaro.com</a>.
      </p>
    </LegalLayout>
  );
}
