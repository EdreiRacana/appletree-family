-- =============================================================================
-- Migration 003 — Invitation Tokens
-- =============================================================================
-- Cada vez que un usuario invita a alguien por correo se crea un registro en
-- public.invites con un token único. El link del correo incluye ese token.
-- Cuando el invitado abre el link:
--   1. Frontend lee ?invite=<token>
--   2. Si ya está logueado → marca aceptado + linkea auth.uid() al member
--   3. Si no → signup pre-llenado con email → al terminar signup, linkea
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.invites (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token             TEXT UNIQUE NOT NULL,
  tree_id           UUID NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  member_id         UUID REFERENCES public.members(id) ON DELETE CASCADE,
  email             TEXT NOT NULL,
  invited_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  side              TEXT,
  personal_message  TEXT,
  accepted_at       TIMESTAMPTZ,
  accepted_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_invites_token ON public.invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_tree ON public.invites(tree_id);
CREATE INDEX IF NOT EXISTS idx_invites_email ON public.invites(email);

-- RLS
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Lectura pública por token — el token ES el secreto (128 bits de entropía).
-- Sin token no hay forma de listar; con token puede leer el registro.
DROP POLICY IF EXISTS "invites_read_public" ON public.invites;
CREATE POLICY "invites_read_public" ON public.invites
  FOR SELECT USING (true);

-- Insert: solo el owner del árbol puede crear invites de su árbol.
-- La Edge Function usa service_role (bypasa RLS) para crearlas.
DROP POLICY IF EXISTS "invites_insert_owner" ON public.invites;
CREATE POLICY "invites_insert_owner" ON public.invites
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trees
      WHERE trees.id = tree_id AND trees.owner_id = auth.uid()
    )
  );

-- Update: cualquier usuario autenticado puede marcarlo como aceptado si el
-- token todavía no ha sido aceptado y no ha expirado. Esto permite aceptar
-- sin conocer al owner.
DROP POLICY IF EXISTS "invites_accept" ON public.invites;
CREATE POLICY "invites_accept" ON public.invites
  FOR UPDATE USING (
    accepted_at IS NULL AND expires_at > NOW() AND auth.uid() IS NOT NULL
  );

COMMENT ON TABLE public.invites IS 'Tokens de invitación que enlazan al invitado con un member existente al aceptar.';
