import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

type ContactPayload = {
  name: string;
  email: string;
  phone: string;
  role: "Enseignant" | "Responsable" | "Autres";
  subject: string;
  message: string;
};

function splitName(fullName: string): { firstname: string; lastname: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstname: "", lastname: "" };
  if (parts.length === 1) return { firstname: parts[0], lastname: "" };
  return {
    firstname: parts[0],
    lastname: parts.slice(1).join(" "),
  };
}

function isEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeHubspotSubject(subject: string): string {
  const s = subject.trim().toLowerCase();
  if (!s) return "Autres";
  if (s.includes("tarif")) return "Discussion Tarifaire";
  if (s.includes("demo") || s.includes("démo")) return "Démo Produit";
  if (s.includes("support") || s.includes("audit")) return "Audit de Processus";
  if (s.includes("partenariat") || s.includes("autre")) return "Autres";
  return "Autres";
}

function normalizeLeadStatus(value: string): string {
  const raw = value.trim();
  const upper = raw.toUpperCase();
  const allowed = new Set([
    "NEW",
    "OPEN",
    "IN_PROGRESS",
    "OPEN_DEAL",
    "UNQUALIFIED",
    "ATTEMPTED_TO_CONTACT",
    "CONNECTED",
    "BAD_TIMING",
  ]);
  if (allowed.has(upper)) return upper;

  const lower = raw.toLowerCase();
  if (lower === "nouveau") return "NEW";
  if (lower === "ouvert") return "OPEN";
  if (lower === "en cours") return "IN_PROGRESS";
  if (lower === "opportunite ouverte" || lower === "opportunité ouverte") return "OPEN_DEAL";
  if (lower === "non qualifie" || lower === "non qualifié") return "UNQUALIFIED";
  if (lower === "tentative de contact") return "ATTEMPTED_TO_CONTACT";
  if (lower === "connecte" || lower === "connecté") return "CONNECTED";
  if (lower === "mauvais timing") return "BAD_TIMING";

  return "NEW";
}

async function sendAcknowledgementEmail(payload: {
  name: string;
  email: string;
  role: string;
  subject: string;
  message: string;
}) {
  const smtpHost = process.env.SMTP_HOST || process.env.MAIL_HOST;
  const smtpPortRaw = process.env.SMTP_PORT || process.env.MAIL_PORT;
  const smtpUser = process.env.SMTP_USER || process.env.MAIL_USERNAME;
  const smtpPass = process.env.SMTP_PASS || process.env.MAIL_PASSWORD;
  const smtpFrom =
    process.env.SMTP_FROM ||
    (process.env.MAIL_FROM_NAME && (process.env.SMTP_USER || process.env.MAIL_USERNAME)
      ? `${process.env.MAIL_FROM_NAME} <${process.env.SMTP_USER || process.env.MAIL_USERNAME}>`
      : undefined);

  if (!smtpHost || !smtpPortRaw || !smtpUser || !smtpPass || !smtpFrom) {
    return;
  }

  const smtpPort = Number(smtpPortRaw);
  const mailEncryption = (process.env.MAIL_ENCRYPTION || "").toLowerCase();
  const secure = mailEncryption === "ssl" || smtpPort === 465;
  const replyTo = process.env.SMTP_REPLY_TO || "contact@correxia.fr";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://correxia.app";
  const logoUrl = `${siteUrl.replace(/\/$/, "")}/logo-correxia-mark.png`;
  const escapedName = payload.name.replace(/[<>&"]/g, "");
  const escapedSubject = payload.subject.replace(/[<>&"]/g, "");
  const escapedMessage = payload.message.replace(/[<>&"]/g, "");

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const html = `
    <div style="font-family: Arial, sans-serif; background: #f6f7fb; padding: 24px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e8ebf3;">
        <tr>
          <td style="background: linear-gradient(135deg, #0d7bf2, #4f46e5); padding: 20px 24px; color: #ffffff;">
            <img src="${logoUrl}" alt="CORREXIA" width="44" height="44" style="display:block; border-radius: 8px; margin-bottom: 10px;" />
            <h1 style="margin: 0; font-size: 20px; line-height: 1.25;">Merci pour votre message</h1>
            <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.95;">Nous avons bien reçu votre demande.</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px;">
            <p style="margin: 0 0 12px; color: #1f2937; font-size: 14px;">Bonjour ${escapedName || "à vous"},</p>
            <p style="margin: 0 0 12px; color: #374151; font-size: 14px; line-height: 1.6;">
              Votre demande a bien été enregistrée. Un membre de l'équipe CORREXIA vous répondra rapidement.
            </p>
            <div style="margin-top: 14px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 14px;">
              <p style="margin: 0 0 6px; font-size: 13px; color: #111827;"><strong>Fonction :</strong> ${payload.role}</p>
              <p style="margin: 0 0 6px; font-size: 13px; color: #111827;"><strong>Sujet :</strong> ${escapedSubject}</p>
              <p style="margin: 0; font-size: 13px; color: #111827;"><strong>Message :</strong> ${escapedMessage}</p>
            </div>
            <p style="margin: 16px 0 0; color: #6b7280; font-size: 12px;">
              Vous pouvez répondre directement à cet email pour compléter votre demande.
            </p>
          </td>
        </tr>
      </table>
    </div>
  `;

  await transporter.sendMail({
    from: smtpFrom,
    to: payload.email,
    replyTo,
    subject: "CORREXIA — Merci pour votre message",
    html,
    text: `Bonjour ${payload.name},\n\nVotre demande a bien été reçue. Nous revenons vers vous rapidement.\n\nFonction: ${payload.role}\nSujet: ${payload.subject}\nMessage: ${payload.message}\n\nCORREXIA`,
  });
}

export async function POST(request: Request) {
  const hubspotToken = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!hubspotToken) {
    return NextResponse.json(
      { error: "HubSpot non configuré (HUBSPOT_ACCESS_TOKEN manquant)." },
      { status: 500 },
    );
  }

  let body: ContactPayload;
  try {
    body = (await request.json()) as ContactPayload;
  } catch {
    return NextResponse.json({ error: "Payload JSON invalide." }, { status: 400 });
  }

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const phone = String(body.phone || "").trim();
  const role = String(body.role || "").trim();
  const subject = String(body.subject || "").trim();
  const message = String(body.message || "").trim();

  if (!name || !email || !phone || !role || !subject || !message) {
    return NextResponse.json(
      { error: "Tous les champs sont obligatoires." },
      { status: 400 },
    );
  }
  if (!isEmailValid(email)) {
    return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
  }

  const { firstname, lastname } = splitName(name);

  const properties: Record<string, string> = {
    email,
    firstname,
    lastname,
    phone,
    jobtitle: role,
    company: "CORREXIA inbound",
    website: "correxia.app",
  };
  const roleProperty = (process.env.HUBSPOT_ROLE_PROPERTY?.trim() || "fonction").toLowerCase();
  const subjectProperty = (process.env.HUBSPOT_SUBJECT_PROPERTY?.trim() || "sujet").toLowerCase();
  const messageProperty = (process.env.HUBSPOT_MESSAGE_PROPERTY?.trim() || "message").toLowerCase();
  const leadStatusProperty = (
    process.env.HUBSPOT_LEAD_STATUS_PROPERTY?.trim() || "hs_lead_status"
  ).toLowerCase();
  const leadStatusValue = normalizeLeadStatus(
    process.env.HUBSPOT_LEAD_STATUS_VALUE?.trim() || "NEW",
  );
  if (roleProperty) properties[roleProperty] = role;
  if (subjectProperty) properties[subjectProperty] = normalizeHubspotSubject(subject);
  if (messageProperty) properties[messageProperty] = message;
  if (leadStatusProperty) properties[leadStatusProperty] = leadStatusValue;

  let contactId: string | undefined;

  // 1) tentative update d'un contact existant via email
  const updateResponse = await fetch(
    `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${hubspotToken}`,
      },
      body: JSON.stringify({ properties }),
    },
  );

  if (updateResponse.ok) {
    const updateData = (await updateResponse.json()) as { id?: string };
    contactId = updateData.id;
  } else if (updateResponse.status === 404) {
    // 2) s'il n'existe pas, on le crée
    const createResponse = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${hubspotToken}`,
      },
      body: JSON.stringify({ properties }),
    });

    if (!createResponse.ok) {
      const text = await createResponse.text();
      return NextResponse.json(
        { error: `Erreur HubSpot (contact): ${text}` },
        { status: 502 },
      );
    }

    const createData = (await createResponse.json()) as { id?: string };
    contactId = createData.id;
  } else {
    const text = await updateResponse.text();
    return NextResponse.json(
      { error: `Erreur HubSpot (contact): ${text}` },
      { status: 502 },
    );
  }

  // On crée aussi une note associée au contact pour conserver sujet + message.
  if (!contactId) {
    return NextResponse.json({ ok: true });
  }

  const noteBody = `Formulaire landing CORREXIA\n\nFonction: ${role}\nSujet: ${subject}\n\nMessage:\n${message}`;
  const noteResponse = await fetch("https://api.hubapi.com/crm/v3/objects/notes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${hubspotToken}`,
    },
    body: JSON.stringify({
      properties: {
        hs_timestamp: new Date().toISOString(),
        hs_note_body: noteBody,
      },
      associations: [
        {
          to: { id: contactId },
          types: [
            {
              associationCategory: "HUBSPOT_DEFINED",
              associationTypeId: 202,
            },
          ],
        },
      ],
    }),
  });

  if (!noteResponse.ok) {
    const text = await noteResponse.text();
    return NextResponse.json(
      { error: `Contact créé, mais note non enregistrée: ${text}` },
      { status: 502 },
    );
  }

  try {
    await sendAcknowledgementEmail({ name, email, role, subject, message });
  } catch (err) {
    console.error("SMTP acknowledgement failed", err);
  }

  return NextResponse.json({ ok: true });
}

