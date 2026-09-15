// Supabase Edge Function: send-invite
// Envía una invitación por correo usando Resend. La API key vive en los
// secrets de Supabase (RESEND_API_KEY) — nunca en el repo.
//
// Deploy:
//   npx supabase functions deploy send-invite --project-ref <ref>
//   npx supabase secrets set RESEND_API_KEY=re_xxx --project-ref <ref>
//
// Invocación desde el front:
//   supabase.functions.invoke('send-invite', { body: {...} })

// deno-lint-ignore-file no-explicit-any
declare const Deno: any

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface InviteBody {
  toEmail: string
  memberName: string
  memberSide?: string
  senderName?: string
  personalMessage?: string
  treeUrl?: string
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
  // El logo se sirve desde el mismo dominio del árbol; email clients lo
  // cargan directo desde HTTPS. Se centra sobre el header verde-slate.
  const logoUrl = `${treeUrl.replace(/\/$/, '')}/assets/logo.png`
  return `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Invitación a AppleFamily Tree</title></head>
  <body style="margin:0;padding:0;background:linear-gradient(180deg,#F5F0E8 0%,#EDE3CE 100%);font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#2C1810">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:48px 20px">
      <tr><td align="center">
        <table role="presentation" width="580" cellpadding="0" cellspacing="0"
               style="background:#FFFFFF;border-radius:22px;border:1px solid rgba(212,175,55,0.28);overflow:hidden;box-shadow:0 12px 40px rgba(44,24,16,0.10)">

          <!-- HEADER · verde-slate con logo dorado -->
          <tr><td style="background:#1E2A22;background-image:radial-gradient(circle at 50% 0%,#2A3C30 0%,#1E2A22 60%);padding:40px 32px 34px;text-align:center;border-bottom:2px solid #D4AF37">
            <img src="${logoUrl}" alt="AppleFamily Tree" width="74" height="74"
                 style="display:block;margin:0 auto 14px;filter:drop-shadow(0 4px 12px rgba(212,175,55,0.35))" />
            <div style="font-family:Georgia,'Times New Roman',serif;color:#D4AF37;font-size:28px;font-weight:600;letter-spacing:0.02em;line-height:1.1">
              AppleFamily <span style="font-style:italic">Tree</span>
            </div>
            <div style="margin-top:10px;color:#F5E6C8;font-size:11px;letter-spacing:0.32em;text-transform:uppercase;opacity:0.75">
              · Una invitación especial ·
            </div>
          </td></tr>

          <!-- BODY -->
          <tr><td style="padding:44px 40px 32px">
            <h2 style="margin:0 0 16px;font-size:23px;color:#2C1810;font-family:Georgia,serif;font-weight:600;line-height:1.3">
              ${sender} quiere que formes parte de nuestro árbol familiar
            </h2>
            <p style="margin:0 0 22px;color:#5A4A3E;font-size:15px;line-height:1.65">
              Estás invitado como <strong style="color:#8B6508">${memberName}</strong> a unirte a nuestro legado familiar en AppleFamily Tree — un espacio privado para preservar memorias, fechas y fotografías que van pasando entre generaciones.
            </p>
            ${message ? `
            <div style="margin:0 0 28px;padding:18px 22px;border-left:3px solid #D4AF37;background:#FAF6F0;border-radius:0 10px 10px 0">
              <div style="font-family:Georgia,serif;color:#B8860B;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px">Mensaje personal</div>
              <p style="margin:0;color:#3D2B1F;font-style:italic;font-size:14.5px;line-height:1.6">${message}</p>
            </div>` : ''}
            <p style="margin:32px 0 8px;text-align:center">
              <a href="${treeUrl}"
                 style="display:inline-block;padding:15px 40px;background:linear-gradient(135deg,#D4AF37 0%,#B8860B 100%);color:#1E2A22;border-radius:12px;text-decoration:none;font-weight:800;letter-spacing:0.04em;font-size:14px;box-shadow:0 8px 20px rgba(184,134,11,0.28)">
                Aceptar y ver el árbol
              </a>
            </p>
            <p style="margin:14px 0 0;text-align:center;font-size:11px;color:#8A7A6D;letter-spacing:0.06em">
              🍎 &nbsp; Cultivando raíces, celebrando legados
            </p>
          </td></tr>

          <!-- FOOTER -->
          <tr><td style="padding:20px 32px 26px;border-top:1px solid rgba(212,175,55,0.20);background:#FAF6F0">
            <p style="margin:0;font-size:11px;color:#7A6558;line-height:1.6;text-align:center">
              Recibiste este correo porque un familiar te invitó a AppleFamily Tree.<br />
              Si no reconoces al remitente, puedes ignorar este mensaje.
            </p>
          </td></tr>
        </table>
        <p style="margin:18px 0 0;font-size:10px;color:#8A7A6D;letter-spacing:0.15em;text-transform:uppercase">
          AppleFamily Tree · sthenova.com
        </p>
      </td></tr>
    </table>
  </body>
</html>`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY missing in Supabase secrets' }), {
        status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }
    const from = Deno.env.get('INVITE_FROM') || 'AppleFamily Tree <no-reply@sthenova.com>'
    const defaultUrl = Deno.env.get('APP_URL') || 'https://appletree-family.vercel.app'

    const body = (await req.json()) as InviteBody
    if (!body?.toEmail || !isValidEmail(body.toEmail)) {
      return new Response(JSON.stringify({ error: 'Correo destino inválido' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }
    if (!body?.memberName) {
      return new Response(JSON.stringify({ error: 'Falta el nombre del familiar' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const treeUrl = body.treeUrl || defaultUrl
    const html = renderEmail(body, treeUrl)
    const subject = `${body.senderName || 'Tu familia'} te invita a AppleFamily Tree`

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [body.toEmail], subject, html }),
    })
    const data = await resendRes.json().catch(() => ({}))
    if (!resendRes.ok) {
      return new Response(JSON.stringify({ error: data?.message || 'Resend error', detail: data }), {
        status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ ok: true, id: data?.id }), {
      status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
