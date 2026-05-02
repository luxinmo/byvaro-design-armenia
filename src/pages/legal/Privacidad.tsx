/**
 * Pantalla pública · Política de Privacidad (`/legal/privacidad`).
 *
 * Documento informativo conforme al RGPD (Reglamento UE 2016/679) y a
 * la LOPDGDD (Ley Orgánica 3/2018). Vinculado a los Términos vía el
 * checkbox del registro.
 *
 * Para modificar la política, edita este archivo y bumpea
 * `LEGAL_VERSION` en `src/lib/legalVersion.ts`.
 */

import { LEGAL_UPDATED_AT, LEGAL_VERSION } from "@/lib/legalVersion";
import { LegalLayout } from "./LegalLayout";

export default function Privacidad() {
  return (
    <LegalLayout
      title="Política de Privacidad"
      version={LEGAL_VERSION}
      updatedAt={LEGAL_UPDATED_AT}
    >
      <p>
        En <strong>Byvaro</strong> nos tomamos la privacidad muy en serio. Esta
        política describe cómo recogemos, usamos y protegemos tus datos personales
        cuando utilizas la plataforma. Está redactada conforme al{" "}
        <strong>Reglamento (UE) 2016/679 (RGPD)</strong> y a la{" "}
        <strong>Ley Orgánica 3/2018 de Protección de Datos Personales y Garantía de
        Derechos Digitales (LOPDGDD)</strong>.
      </p>

      <h2>1. Responsable del tratamiento</h2>
      <p>
        El responsable del tratamiento de tus datos es <strong>Byvaro</strong>, con
        domicilio en España y contacto a través de{" "}
        <a href="mailto:privacidad@byvaro.com">privacidad@byvaro.com</a>. Puedes
        dirigirte a esta dirección para cualquier asunto relacionado con tus datos
        personales.
      </p>

      <h2>2. Datos que recogemos</h2>
      <p>
        Cuando te registras y utilizas el Servicio recogemos las siguientes
        categorías de datos:
      </p>
      <ul>
        <li>
          <strong>Datos identificativos.</strong> Nombre completo, email
          profesional, teléfono y empresa.
        </li>
        <li>
          <strong>Credenciales.</strong> Contraseña almacenada cifrada (hash
          bcrypt). Nunca tenemos acceso a tu contraseña en texto claro.
        </li>
        <li>
          <strong>Datos de uso.</strong> Direcciones IP, navegador, tipo de
          dispositivo, páginas visitadas, eventos de interacción y registros de
          inicio de sesión, con fines de seguridad y analítica de producto.
        </li>
        <li>
          <strong>Datos de negocio que tú introduces.</strong> Promociones,
          contactos, registros, documentos, comunicaciones y comentarios. Estos
          datos pertenecen a tu organización y los tratamos como{" "}
          <em>encargado del tratamiento</em>.
        </li>
        <li>
          <strong>Datos de facturación.</strong> Si contratas un plan de pago,
          razón social, NIF, dirección fiscal y datos de tarjeta gestionados por
          nuestro proveedor de pagos (Stripe). Byvaro no almacena en sus
          servidores el número completo de tu tarjeta.
        </li>
        <li>
          <strong>Aceptación legal.</strong> Versión de los Términos y de esta
          Política aceptada y fecha de aceptación, con fines de prueba.
        </li>
      </ul>

      <h2>3. Finalidades del tratamiento</h2>
      <p>Tratamos tus datos para:</p>
      <ul>
        <li>Crear y gestionar tu cuenta y la organización a la que perteneces.</li>
        <li>
          Prestar las funcionalidades del Servicio (gestión de promociones,
          contactos, comunicaciones, documentación contractual, colaboraciones
          inter-empresa).
        </li>
        <li>
          Enviarte notificaciones operativas (cambios en colaboraciones,
          aprobaciones, recordatorios) y de seguridad (login desde nuevo
          dispositivo, cambios de contraseña).
        </li>
        <li>Facturar los planes contratados y cumplir obligaciones fiscales.</li>
        <li>
          Mejorar el producto mediante analítica agregada y, cuando proceda,
          comunicaciones sobre nuevas funcionalidades. Puedes oponerte al envío
          de comunicaciones comerciales en cualquier momento.
        </li>
        <li>
          Cumplir obligaciones legales (prevención del fraude, requerimientos
          judiciales, normativa contable y fiscal).
        </li>
      </ul>

      <h2>4. Base legal del tratamiento</h2>
      <p>
        Las bases legales que legitiman el tratamiento son, según el caso:
      </p>
      <ul>
        <li>
          <strong>Ejecución del contrato.</strong> Para prestar el Servicio una
          vez aceptados los Términos.
        </li>
        <li>
          <strong>Consentimiento.</strong> Marcado en el checkbox del registro y
          revocable en cualquier momento desde tus ajustes.
        </li>
        <li>
          <strong>Interés legítimo.</strong> Para seguridad, prevención del fraude
          y mejora del producto, ponderado siempre frente a tus derechos.
        </li>
        <li>
          <strong>Cumplimiento de obligación legal.</strong> Para conservar
          facturas y atender requerimientos administrativos o judiciales.
        </li>
      </ul>

      <h2>5. Destinatarios y encargados del tratamiento</h2>
      <p>
        Tus datos se comparten con los siguientes encargados del tratamiento, que
        actúan bajo nuestras instrucciones y con garantías RGPD:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> (Supabase Inc., con infraestructura en
          AWS eu-west-1, Irlanda) · base de datos, autenticación y almacenamiento.
        </li>
        <li>
          <strong>SendGrid / Twilio</strong> (Twilio Inc., transferencia
          internacional con cláusulas contractuales tipo de la Comisión Europea) ·
          envío de emails transaccionales.
        </li>
        <li>
          <strong>Stripe</strong> (Stripe Payments Europe Ltd., Irlanda) ·
          procesamiento de pagos y emisión de facturas.
        </li>
        <li>
          <strong>Vercel</strong> (Vercel Inc., con infraestructura en regiones
          europeas para Byvaro) · hosting de la aplicación web.
        </li>
        <li>
          <strong>Firmafy</strong> (proveedor español) · firma electrónica
          avanzada de contratos de colaboración.
        </li>
      </ul>
      <p>
        Cuando exista una transferencia internacional fuera del EEE se realizará
        amparada por una decisión de adecuación o por las cláusulas contractuales
        tipo aprobadas por la Comisión Europea, garantizando un nivel de
        protección equivalente.
      </p>

      <h2>6. Plazos de conservación</h2>
      <p>Conservamos tus datos durante:</p>
      <ul>
        <li>El tiempo en que tu cuenta esté activa.</li>
        <li>
          30 días tras la cancelación, para permitir la recuperación o exportación
          de tus datos.
        </li>
        <li>
          5 años para las facturas y documentos de relevancia fiscal, conforme a
          la normativa española.
        </li>
        <li>
          El plazo legal de prescripción de las posibles acciones derivadas del
          contrato (general 5 años en España).
        </li>
      </ul>
      <p>
        Transcurridos esos plazos, los datos se eliminan de forma segura o se
        anonimizan estadísticamente.
      </p>

      <h2>7. Tus derechos</h2>
      <p>
        En cualquier momento puedes ejercer los siguientes derechos sobre tus
        datos:
      </p>
      <ul>
        <li>
          <strong>Acceso.</strong> Saber qué datos tuyos tratamos y obtener una
          copia.
        </li>
        <li>
          <strong>Rectificación.</strong> Solicitar que corrijamos datos
          inexactos o incompletos.
        </li>
        <li>
          <strong>Supresión.</strong> Pedir que eliminemos tus datos cuando ya no
          sean necesarios o retires el consentimiento.
        </li>
        <li>
          <strong>Limitación del tratamiento.</strong> Restringir el uso de tus
          datos en supuestos concretos.
        </li>
        <li>
          <strong>Oposición.</strong> Oponerte al tratamiento basado en interés
          legítimo o a comunicaciones comerciales.
        </li>
        <li>
          <strong>Portabilidad.</strong> Recibir tus datos en formato estructurado
          (CSV/JSON) y transmitirlos a otro responsable.
        </li>
        <li>
          <strong>Retirada del consentimiento.</strong> Revocar en cualquier
          momento el consentimiento prestado, sin afectar a los tratamientos ya
          realizados.
        </li>
        <li>
          <strong>Reclamación.</strong> Presentar una reclamación ante la{" "}
          <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">
            Agencia Española de Protección de Datos (AEPD)
          </a>{" "}
          si consideras que tus derechos no se han atendido correctamente.
        </li>
      </ul>
      <p>
        Para ejercer cualquier derecho escríbenos a{" "}
        <a href="mailto:privacidad@byvaro.com">privacidad@byvaro.com</a> indicando
        "Ejercicio de derechos RGPD" en el asunto y, cuando sea necesario, una
        copia de un documento que acredite tu identidad.
      </p>

      <h2>8. Seguridad</h2>
      <p>
        Aplicamos medidas técnicas y organizativas adecuadas al riesgo, entre
        ellas:
      </p>
      <ul>
        <li>
          Cifrado en tránsito (TLS 1.2+) y en reposo para los datos sensibles.
        </li>
        <li>
          Aislamiento multi-tenant a nivel de base de datos (Row Level Security)
          para que ningún usuario pueda acceder a datos de otra organización.
        </li>
        <li>
          Hash de contraseñas con bcrypt y rotación periódica de claves de API.
        </li>
        <li>
          Control de acceso por roles (admin/member) con auditoría de acciones
          sensibles.
        </li>
        <li>
          Copias de seguridad cifradas y plan de continuidad documentado.
        </li>
      </ul>

      <h2>9. Cookies y tecnologías similares</h2>
      <p>
        Utilizamos cookies estrictamente necesarias para mantener tu sesión y un
        número reducido de cookies analíticas para entender el uso del producto.
        El detalle completo está disponible en nuestra Política de Cookies (en
        preparación). Puedes configurar tu navegador para rechazar cookies no
        esenciales sin que afecte al funcionamiento del Servicio.
      </p>

      <h2>10. Menores</h2>
      <p>
        El Servicio está dirigido a profesionales mayores de 18 años. No recogemos
        de manera consciente datos de menores. Si detectamos que un menor se ha
        registrado, eliminaremos su cuenta y datos asociados.
      </p>

      <h2>11. Cambios en esta política</h2>
      <p>
        Podemos actualizar esta Política para adaptarla a cambios legales o
        funcionales. Los cambios sustanciales se notificarán por email con
        antelación razonable. La fecha de la última actualización aparece en la
        cabecera del documento.
      </p>

      <h2>12. Contacto</h2>
      <p>
        Para cualquier consulta sobre privacidad puedes escribirnos a{" "}
        <a href="mailto:privacidad@byvaro.com">privacidad@byvaro.com</a>. Si has
        sido designado <strong>Delegado de Protección de Datos</strong> en una
        organización cliente, indícalo en tu mensaje para priorizar la atención.
      </p>
    </LegalLayout>
  );
}
