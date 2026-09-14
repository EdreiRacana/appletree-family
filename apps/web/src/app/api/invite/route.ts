import { NextResponse } from 'next/server'
import { Resend } from 'resend'

// Endpoint POST /api/invite — envía la invitación al árbol familiar usando
// Resend. La API key vive en RESEND_API_KEY (env var en Vercel) — nunca en
// el repo. El "from" también vía env var para poder cambiarlo sin redeploy.
export const runtime = 'nodejs'

interface InviteBody {
  toEmail: string
  memberName: string       // a quién estás invitando
  memberSide?: string      // "paternal" | "maternal" | "both"
  senderName?: string      // quien envía la invitación
  personalMessage?: string // texto libre del invitante
  treeUrl?: string         // link al árbol
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderEmail(body: InviteBody, treeUrl: string): string {
  const memberName = escapeHtml(body.memberName)
  const sender = escapeHtml(body.senderName || 'Tu familia')
  const message = escapeHtml(body.personalMessage || '')
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Invitación a AppleFamily Tree</title>
  </head>
  <body style="margin:0;padding:0;background:#F5F0E8;font-family:'Helvetica Neue',Arial,sans-serif;color:#2C1810">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:40px 20px">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0"
                 style="background:#FFFFFF;border-radius:20px;border:1px solid #E8DDD0;overflow:hidden">
            <tr>
              <td style="background:#1E2A22;padding:32px;text-align:center">
                <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;color:#D4AF37;font-size:26px;letter-spacing:0.02em">
                  AppleFamily Tree
                </h1>
                <p style="margin:8px 0 0;color:#F5E6C8;font-size:13px;letter-spacing:0.18em;text-transform:uppercase">
                  Una invitación especial
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px">
                <h2 style="margin:0 0 12px;font-size:22px;color:#2C1810;font-family:Georgia,serif">
                  ${sender} quiere que formes parte de nuestro árbol familiar
                </h2>
                <p style="margin:0 0 20px;color:#5A4A3E;font-size:15px;line-height:1.55">
                  Estás invitado como <strong>${memberName}</strong> a unirte a nuestro legado familiar
                  en AppleFamily Tree — un espacio privado para preservar memorias, fechas y
                  fotografías que van pasando entre generaciones.
                </p>
                ${message ? `<blockquote style="margin:0 0 24px;padding:14px 18px;border-left:3px solid #D4AF37;background:#FAF6F0;color:#3D2B1F;font-style:italic;font-size:14px;line-height:1.5">${message}</blockquote>` : ''}
                <p style="margin:24px 0 0;text-align:center">
                  <a href="${treeUrl}"
                     style="display:inline-block;padding:14px 32px;background:#D4AF37;color:#1E2A22;
                            border-radius:12px;text-decoration:none;font-weight:700;letter-spacing:0.03em;
                            font-size:14px">
                    Aceptar y ver el árbol
                  </a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px;border-top:1px solid #E8DDD0;background:#FAF6F0">
                <p style="margin:0;font-size:11px;color:#7A6558;line-height:1.5;text-align:center">
                  Recibiste este correo porque un familiar te invitó a AppleFamily Tree.
                  Si no reconoces al remitente, puedes ignorar este mensaje.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Email service not configured (missing RESEND_API_KEY)' }, { status: 500 })
    }
    const fromAddress = process.env.INVITE_FROM || 'AppleFamily Tree <no-reply@sthenova.com>'
    const treeUrlDefault = process.env.APP_URL || 'https://appletree-family.vercel.app'

    const body = (await req.json()) as InviteBody
    if (!body?.toEmail || !isValidEmail(body.toEmail)) {
      return NextResponse.json({ error: 'Correo destino inválido' }, { status: 400 })
    }
    if (!body?.memberName) {
      return NextResponse.json({ error: 'Falta el nombre del familiar' }, { status: 400 })
    }

    const treeUrl = body.treeUrl || treeUrlDefault
    const html = renderEmail(body, treeUrl)
    const subject = `${body.senderName || 'Tu familia'} te invita a AppleFamily Tree`

    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [body.toEmail],
      subject,
      html,
      replyTo: process.env.INVITE_REPLY_TO || undefined,
    })
    if (error) {
      return NextResponse.json({ error: error.message || 'Resend error' }, { status: 502 })
    }
    return NextResponse.json({ ok: true, id: data?.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
