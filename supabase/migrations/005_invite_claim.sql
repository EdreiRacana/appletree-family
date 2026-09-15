-- =============================================================================
-- Migration 005 — Fix: RLS permite al invitado reclamar su manzana
-- =============================================================================
-- Bug: al aceptar una invitación, processPendingInvite marca el invite como
-- aceptado (allowed por invites_accept) y luego trata de escribir el user_id
-- del invitado en el member correspondiente. Pero la única policy UPDATE de
-- members es members_owner_full_access — solo el owner del árbol. El
-- invitado NO es owner, así que el UPDATE se ignora silenciosamente y el
-- vínculo cuenta↔manzana nunca se crea.
--
-- Fix: policy nueva que permite al invitado UPDATE el member enlazado en su
-- invite YA ACEPTADO por él. Se limita a solo los campos user_id/updated_at
-- vía el flujo controlado del frontend — no queremos que un invitado edite
-- otros campos del member.
-- =============================================================================

DROP POLICY IF EXISTS "members_invite_claim" ON public.members;
CREATE POLICY "members_invite_claim"
  ON public.members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.invites i
      WHERE i.member_id = public.members.id
        AND i.accepted_by = auth.uid()
        AND i.accepted_at IS NOT NULL
    )
  );

-- Sanity: contar cuántos invites ya fueron aceptados sin quedar linkeados.
-- Si sale > 0, esos usuarios se resuelven en el próximo login por el
-- fallback nuevo en applySupabaseSession + una re-ejecución silenciosa
-- desde el frontend.
SELECT
  COUNT(*) FILTER (WHERE i.accepted_at IS NOT NULL AND m.user_id IS NULL) AS invites_aceptados_sin_link,
  COUNT(*) FILTER (WHERE i.accepted_at IS NOT NULL AND m.user_id IS NOT NULL) AS invites_aceptados_ok
FROM public.invites i
LEFT JOIN public.members m ON m.id = i.member_id;
