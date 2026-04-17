-- =============================================================================
-- AppleTree Family — Supabase SQL Schema (Migration 001)
-- =============================================================================
-- Architecture: Supabase (Postgres + Auth + Realtime + RLS)
-- Compatible with: Supabase hosted or self-hosted
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy name search

-- =============================================================================
-- SECTION 1: ENUM TYPES
-- =============================================================================

-- Apple node color / branch type
CREATE TYPE apple_type AS ENUM (
  'red',        -- Direct bloodline (parents, children, siblings)
  'green',      -- Extended family / spouse / in-laws
  'pink'        -- Baby / newborn (auto-assigned by DOB)
);

-- Relationship kind between two members
CREATE TYPE relationship_type AS ENUM (
  'parent',      -- member_1 IS PARENT OF member_2
  'child',       -- member_1 IS CHILD OF member_2
  'spouse',      -- member_1 IS SPOUSE OF member_2
  'sibling',     -- member_1 IS SIBLING OF member_2
  'grandparent', -- member_1 IS GRANDPARENT OF member_2
  'grandchild',  -- member_1 IS GRANDCHILD OF member_2
  'uncle_aunt',
  'nephew_niece',
  'cousin',
  'step_parent',
  'step_child',
  'adoptive_parent',
  'adopted_child',
  'other'
);

-- Privacy levels for tree branches / members
CREATE TYPE privacy_level AS ENUM (
  'private',    -- Visible only to tree owner
  'core',       -- Visible to direct family (same tree)
  'extended',   -- Visible to approved extended connections
  'public'      -- Visible to platform users (legacy/public mode)
);

-- Access grant status
CREATE TYPE access_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'revoked'
);

-- Chat message status
CREATE TYPE message_status AS ENUM (
  'sent',
  'delivered',
  'read'
);

-- =============================================================================
-- SECTION 2: CORE USER PROFILE TABLE
-- Synced with Supabase auth.users via trigger
-- =============================================================================

CREATE TABLE public.users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username        TEXT UNIQUE,
  full_name       TEXT,
  email           TEXT UNIQUE NOT NULL,
  avatar_url      TEXT,       -- Cloudinary URL for profile photo
  cloudinary_id   TEXT,       -- Cloudinary public_id for transforms
  bio             TEXT,
  date_of_birth   DATE,
  phone           TEXT,
  country_code    TEXT DEFAULT 'US',
  is_verified     BOOLEAN DEFAULT FALSE,
  is_active       BOOLEAN DEFAULT TRUE,
  notification_prefs JSONB DEFAULT '{
    "email_birthdays": true,
    "email_achievements": true,
    "push_messages": true,
    "push_family_buzz": true
  }'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.users IS 'Extended profile for authenticated users. Linked 1:1 with auth.users.';
COMMENT ON COLUMN public.users.cloudinary_id IS 'Used to generate responsive transforms via Cloudinary URL API.';

-- =============================================================================
-- SECTION 3: TREES TABLE
-- Each family unit owns one "apple tree"
-- =============================================================================

CREATE TABLE public.trees (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,                    -- "The Pérez Family Tree"
  description     TEXT,
  cover_image_url TEXT,                             -- Cloudinary background image
  default_privacy privacy_level DEFAULT 'core',    -- Tree-wide default
  is_public_legacy BOOLEAN DEFAULT FALSE,           -- "Legado Público" flag
  member_count    INT DEFAULT 0,                    -- Denormalized for performance
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.trees IS 'Each family group owns one tree. Owner controls all privacy settings.';
COMMENT ON COLUMN public.trees.is_public_legacy IS 'When true, the tree is visible as a public legacy (ancestor research mode).';

-- =============================================================================
-- SECTION 4: MEMBERS TABLE
-- Each node on the tree is a "member" (apple)
-- =============================================================================

CREATE TABLE public.members (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tree_id         UUID NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES public.users(id) ON DELETE SET NULL, -- NULL if deceased/not registered
  
  -- Identity
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  maiden_name     TEXT,                             -- For married surnames
  nickname        TEXT,
  
  -- Dates
  date_of_birth   DATE,
  date_of_death   DATE,                             -- NULL if alive
  birth_place     TEXT,
  
  -- Apple node appearance
  apple_type      apple_type NOT NULL DEFAULT 'red',
  avatar_cloudinary_id TEXT,                        -- Cloudinary public_id
  avatar_url      TEXT,                             -- Resolved Cloudinary URL
  is_baby         BOOLEAN GENERATED ALWAYS AS (
    date_of_birth IS NOT NULL AND
    date_of_birth > (CURRENT_DATE - INTERVAL '3 years')
  ) STORED,                                         -- Auto baby icon
  is_deceased     BOOLEAN GENERATED ALWAYS AS (
    date_of_death IS NOT NULL
  ) STORED,
  
  -- Position in tree canvas (for layout persistence)
  canvas_x        FLOAT,
  canvas_y        FLOAT,
  generation      INT,                              -- 0 = root, negative = ancestors
  
  -- Privacy
  member_privacy  privacy_level DEFAULT 'core',     -- Override tree default
  
  -- Metadata
  biography       TEXT,
  occupation      TEXT,
  nationality     TEXT,
  notes           TEXT,                             -- Private notes by tree owner
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure name is searchable
  search_vector   TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(nickname, ''))
  ) STORED
);

CREATE INDEX idx_members_tree_id ON public.members(tree_id);
CREATE INDEX idx_members_user_id ON public.members(user_id);
CREATE INDEX idx_members_search ON public.members USING GIN(search_vector);
CREATE INDEX idx_members_apple_type ON public.members(apple_type);

COMMENT ON TABLE public.members IS 'Each apple node on a tree. Can be linked to a registered user or be a historical/deceased entry.';
COMMENT ON COLUMN public.members.is_baby IS 'Auto-computed: true if DOB is within last 3 years. Triggers baby avatar in UI.';
COMMENT ON COLUMN public.members.generation IS '0 = base generation (e.g. yourself). Negative = older ancestors. Positive = children/grandchildren.';

-- =============================================================================
-- SECTION 5: RELATIONSHIPS TABLE
-- Directed graph of family connections
-- =============================================================================

CREATE TABLE public.relationships (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tree_id         UUID NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  member_1_id     UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  member_2_id     UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  relationship    relationship_type NOT NULL,
  
  -- For marriages: start/end dates
  start_date      DATE,                             -- Wedding date
  end_date        DATE,                             -- Divorce or death date
  is_active       BOOLEAN DEFAULT TRUE,
  
  -- Notes (e.g. "Adopted in 1985")
  notes           TEXT,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate directed relationships
  UNIQUE (member_1_id, member_2_id, relationship),
  -- Prevent self-relationships
  CHECK (member_1_id <> member_2_id)
);

CREATE INDEX idx_relationships_member_1 ON public.relationships(member_1_id);
CREATE INDEX idx_relationships_member_2 ON public.relationships(member_2_id);
CREATE INDEX idx_relationships_tree_id ON public.relationships(tree_id);

COMMENT ON TABLE public.relationships IS 'Directed graph edges between member nodes. Always insert bidirectional pairs (parent→child AND child→parent).';

-- =============================================================================
-- SECTION 6: PRIVACY RULES TABLE
-- Fine-grained cross-tree access control (the security core)
-- =============================================================================

CREATE TABLE public.privacy_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- WHO owns this rule (grants access FROM their tree)
  grantor_tree_id UUID NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  
  -- WHAT is being shared  (NULL = entire tree)
  target_member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,  -- Specific member
  target_tree_branch TEXT,  -- E.g. 'generation:-3' for only great-grandparents branch
  
  -- TO WHOM (grantee can be a tree or a specific user)
  grantee_tree_id UUID REFERENCES public.trees(id) ON DELETE CASCADE,
  grantee_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Access level granted
  access_level    privacy_level NOT NULL DEFAULT 'extended',
  
  -- Access lifecycle
  status          access_status NOT NULL DEFAULT 'pending',
  expires_at      TIMESTAMPTZ,                      -- Optional expiry
  
  -- Audit
  granted_by      UUID REFERENCES public.users(id),
  approved_by     UUID REFERENCES public.users(id),
  requested_at    TIMESTAMPTZ DEFAULT NOW(),
  approved_at     TIMESTAMPTZ,
  notes           TEXT,
  
  -- Either grantee tree or user must be set
  CHECK (grantee_tree_id IS NOT NULL OR grantee_user_id IS NOT NULL)
);

CREATE INDEX idx_privacy_grantor ON public.privacy_rules(grantor_tree_id);
CREATE INDEX idx_privacy_grantee_tree ON public.privacy_rules(grantee_tree_id);
CREATE INDEX idx_privacy_grantee_user ON public.privacy_rules(grantee_user_id);
CREATE INDEX idx_privacy_target_member ON public.privacy_rules(target_member_id);

COMMENT ON TABLE public.privacy_rules IS 'Cross-tree access control. Core (same tree) access is implicit. Extended/Public requires an approved rule here.';
COMMENT ON COLUMN public.privacy_rules.access_level IS 'core=direct family only | extended=approved extended | public=anyone on platform';

-- =============================================================================
-- SECTION 7: CHATS & MESSAGES (Supabase Realtime)
-- Private 1:1 chats between registered users
-- =============================================================================

CREATE TABLE public.chats (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Participants stored as sorted array for uniqueness
  participant_1   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  participant_2   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  
  -- Each pair can only have one chat
  UNIQUE (participant_1, participant_2),
  CHECK (participant_1 < participant_2)   -- Enforce ordering for uniqueness
);

CREATE INDEX idx_chats_p1 ON public.chats(participant_1);
CREATE INDEX idx_chats_p2 ON public.chats(participant_2);
CREATE INDEX idx_chats_last_msg ON public.chats(last_message_at DESC);

COMMENT ON TABLE public.chats IS 'Private 1:1 chat rooms. participant_1 UUID must always be < participant_2 UUID for uniqueness.';

CREATE TABLE public.messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id         UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content         TEXT,                             -- Text content
  attachment_url  TEXT,                             -- Cloudinary or B2 URL
  attachment_type TEXT,                             -- 'image', 'video', 'audio', etc.
  status          message_status DEFAULT 'sent',
  is_deleted      BOOLEAN DEFAULT FALSE,            -- Soft delete
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  read_at         TIMESTAMPTZ
);

CREATE INDEX idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_created ON public.messages(created_at DESC);

COMMENT ON TABLE public.messages IS 'Chat messages. Enable Supabase Realtime on this table for live chat.';

-- =============================================================================
-- SECTION 8: ACTIVITY FEED (Family Buzz)
-- Birthdays, achievements, greetings, photo uploads
-- =============================================================================

CREATE TYPE activity_type AS ENUM (
  'birthday',
  'anniversary',
  'achievement',
  'greeting',
  'photo_upload',
  'new_member',
  'memorial'
);

CREATE TABLE public.activities (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tree_id         UUID NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  actor_user_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  activity_type   activity_type NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  image_url       TEXT,                             -- Preview image
  metadata        JSONB DEFAULT '{}',               -- Flexible extra data
  privacy         privacy_level DEFAULT 'core',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activities_tree ON public.activities(tree_id);
CREATE INDEX idx_activities_created ON public.activities(created_at DESC);
CREATE INDEX idx_activities_type ON public.activities(activity_type);

COMMENT ON TABLE public.activities IS 'Activity feed items (Family Buzz). Includes birthdays auto-generated by a cron function.';

-- =============================================================================
-- SECTION 9: PHOTO ALBUMS (Backblaze B2 + Cloudflare CDN)
-- =============================================================================

CREATE TABLE public.albums (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tree_id         UUID NOT NULL REFERENCES public.trees(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  cover_url       TEXT,                             -- Cloudinary thumbnail
  privacy         privacy_level DEFAULT 'core',
  is_shared       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.photos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id        UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  uploaded_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Backblaze B2 storage
  b2_file_id      TEXT,                             -- Backblaze B2 file ID
  b2_file_name    TEXT,                             -- Path in B2 bucket
  cdn_url         TEXT,                             -- Public Cloudflare CDN URL
  
  -- Cloudinary thumbnail (optimized preview)
  thumbnail_cloudinary_id TEXT,
  thumbnail_url   TEXT,
  
  caption         TEXT,
  width           INT,
  height          INT,
  file_size_bytes BIGINT,
  taken_at        DATE,
  location        TEXT,
  tagged_members  UUID[],                           -- Array of member IDs tagged
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_photos_album ON public.photos(album_id);
CREATE INDEX idx_photos_uploader ON public.photos(uploaded_by);

-- =============================================================================
-- SECTION 10: HELPER FUNCTIONS
-- =============================================================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sync new Supabase auth user → public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update member_count on trees when a member is added/removed
CREATE OR REPLACE FUNCTION public.handle_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.trees SET member_count = member_count + 1 WHERE id = NEW.tree_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.trees SET member_count = member_count - 1 WHERE id = OLD.tree_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SECTION 11: TRIGGERS
-- =============================================================================

-- Auto-sync new auth users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at triggers
CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_trees
  BEFORE UPDATE ON public.trees
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_members
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Member count maintenance
CREATE TRIGGER on_member_insert
  AFTER INSERT ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.handle_member_count();

CREATE TRIGGER on_member_delete
  AFTER DELETE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.handle_member_count();

-- =============================================================================
-- SECTION 12: ROW LEVEL SECURITY (RLS) POLICIES
-- The privacy enforcement layer — critical for data isolation
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- HELPER: Check if current user has approved extended access to a tree
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_extended_access(p_tree_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.privacy_rules pr
    WHERE pr.grantor_tree_id = p_tree_id
      AND pr.status = 'approved'
      AND (pr.expires_at IS NULL OR pr.expires_at > NOW())
      AND (
        pr.grantee_user_id = auth.uid()
        OR pr.grantee_tree_id IN (
          SELECT t.id FROM public.trees t WHERE t.owner_id = auth.uid()
        )
      )
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- USERS TABLE — Users can see their own profile and basic info of others
-- ---------------------------------------------------------------------------
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users_select_others_basic"
  ON public.users FOR SELECT
  USING (is_active = TRUE);  -- Any authenticated user can see basic profiles

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (id = auth.uid());

-- ---------------------------------------------------------------------------
-- TREES TABLE
-- ---------------------------------------------------------------------------
CREATE POLICY "trees_owner_full_access"
  ON public.trees FOR ALL
  USING (owner_id = auth.uid());

CREATE POLICY "trees_extended_read"
  ON public.trees FOR SELECT
  USING (
    -- Public legacy trees are visible to all
    is_public_legacy = TRUE
    OR
    -- Extended access granted via privacy_rules
    public.user_has_extended_access(id)
  );

-- ---------------------------------------------------------------------------
-- MEMBERS TABLE — Core privacy logic
-- ---------------------------------------------------------------------------

-- Tree owner: full access to all their members
CREATE POLICY "members_owner_full_access"
  ON public.members FOR ALL
  USING (
    tree_id IN (
      SELECT id FROM public.trees WHERE owner_id = auth.uid()
    )
  );

-- Registered user: can see their own member record(s)
CREATE POLICY "members_self_read"
  ON public.members FOR SELECT
  USING (user_id = auth.uid());

-- Extended access: family with approved cross-tree permission
CREATE POLICY "members_extended_read"
  ON public.members FOR SELECT
  USING (
    member_privacy IN ('extended', 'public')
    AND public.user_has_extended_access(tree_id)
  );

-- Public legacy access
CREATE POLICY "members_public_legacy"
  ON public.members FOR SELECT
  USING (
    member_privacy = 'public'
    AND tree_id IN (SELECT id FROM public.trees WHERE is_public_legacy = TRUE)
  );

-- ---------------------------------------------------------------------------
-- RELATIONSHIPS TABLE
-- ---------------------------------------------------------------------------
CREATE POLICY "relationships_owner_full_access"
  ON public.relationships FOR ALL
  USING (
    tree_id IN (
      SELECT id FROM public.trees WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "relationships_extended_read"
  ON public.relationships FOR SELECT
  USING (public.user_has_extended_access(tree_id));

-- ---------------------------------------------------------------------------
-- PRIVACY RULES TABLE
-- ---------------------------------------------------------------------------
CREATE POLICY "privacy_rules_grantor_manage"
  ON public.privacy_rules FOR ALL
  USING (
    grantor_tree_id IN (
      SELECT id FROM public.trees WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "privacy_rules_grantee_read"
  ON public.privacy_rules FOR SELECT
  USING (
    grantee_user_id = auth.uid()
    OR grantee_tree_id IN (
      SELECT id FROM public.trees WHERE owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- CHATS TABLE — Only participants can see their chats
-- ---------------------------------------------------------------------------
CREATE POLICY "chats_participants_only"
  ON public.chats FOR SELECT
  USING (participant_1 = auth.uid() OR participant_2 = auth.uid());

CREATE POLICY "chats_create"
  ON public.chats FOR INSERT
  WITH CHECK (participant_1 = auth.uid() OR participant_2 = auth.uid());

-- ---------------------------------------------------------------------------
-- MESSAGES TABLE — Only participants can read/write
-- ---------------------------------------------------------------------------
CREATE POLICY "messages_participant_read"
  ON public.messages FOR SELECT
  USING (
    chat_id IN (
      SELECT id FROM public.chats
      WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
    )
  );

CREATE POLICY "messages_sender_insert"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND chat_id IN (
      SELECT id FROM public.chats
      WHERE participant_1 = auth.uid() OR participant_2 = auth.uid()
    )
  );

CREATE POLICY "messages_sender_soft_delete"
  ON public.messages FOR UPDATE
  USING (sender_id = auth.uid());

-- ---------------------------------------------------------------------------
-- ACTIVITIES TABLE
-- ---------------------------------------------------------------------------
CREATE POLICY "activities_core_read"
  ON public.activities FOR SELECT
  USING (
    -- Tree members can see core activities
    tree_id IN (
      SELECT t.id FROM public.trees t
      JOIN public.members m ON m.tree_id = t.id
      WHERE t.owner_id = auth.uid() OR m.user_id = auth.uid()
    )
    OR
    (privacy IN ('extended', 'public') AND public.user_has_extended_access(tree_id))
    OR
    (privacy = 'public' AND tree_id IN (SELECT id FROM public.trees WHERE is_public_legacy = TRUE))
  );

CREATE POLICY "activities_owner_write"
  ON public.activities FOR INSERT
  WITH CHECK (
    tree_id IN (SELECT id FROM public.trees WHERE owner_id = auth.uid())
    OR actor_user_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- ALBUMS & PHOTOS
-- ---------------------------------------------------------------------------
CREATE POLICY "albums_core_read"
  ON public.albums FOR SELECT
  USING (
    tree_id IN (SELECT id FROM public.trees WHERE owner_id = auth.uid())
    OR (privacy IN ('extended', 'public') AND public.user_has_extended_access(tree_id))
    OR (privacy = 'public' AND tree_id IN (SELECT id FROM public.trees WHERE is_public_legacy = TRUE))
  );

CREATE POLICY "albums_owner_write"
  ON public.albums FOR ALL
  USING (tree_id IN (SELECT id FROM public.trees WHERE owner_id = auth.uid()));

CREATE POLICY "photos_album_access"
  ON public.photos FOR SELECT
  USING (
    album_id IN (
      SELECT id FROM public.albums  -- Inherits album-level policy
    )
  );

CREATE POLICY "photos_uploader_write"
  ON public.photos FOR INSERT
  WITH CHECK (uploaded_by = auth.uid());

-- =============================================================================
-- SECTION 13: REALTIME SUBSCRIPTIONS
-- Enable Supabase Realtime on messages for live chat
-- =============================================================================

-- Run this in Supabase Dashboard → Database → Replication
-- Or via SQL:
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;

-- =============================================================================
-- SECTION 14: SAMPLE SEED DATA (For development/demo)
-- =============================================================================

-- NOTE: Replace UUIDs below with real auth.users IDs after signup
-- This is for illustration only. In production, users are created via auth.

DO $$
DECLARE
  v_tree_id UUID;
  v_member_andres UUID;
  v_member_margarita UUID;
  v_member_carlos UUID;
BEGIN
  -- Insert a demo tree
  INSERT INTO public.trees (id, owner_id, name, default_privacy)
  VALUES (
    'aaaaaaaa-0000-0000-0000-000000000001',
    (SELECT id FROM public.users LIMIT 1),  -- Replace with real user ID
    'The Pérez Family Tree',
    'core'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_tree_id;

  -- Root member: Andrés Pérez
  INSERT INTO public.members (id, tree_id, first_name, last_name, date_of_birth, date_of_death, apple_type, generation)
  VALUES (
    'bbbbbbbb-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Andrés', 'Pérez',
    '1888-03-15', '1972-11-20',
    'red', -2
  ) ON CONFLICT DO NOTHING;

  -- Spouse: Margarita López
  INSERT INTO public.members (id, tree_id, first_name, last_name, date_of_birth, date_of_death, apple_type, generation)
  VALUES (
    'bbbbbbbb-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Margarita', 'López',
    '1888-07-04', '1972-02-14',
    'green', -2
  ) ON CONFLICT DO NOTHING;

  -- Spouse relationship
  INSERT INTO public.relationships (tree_id, member_1_id, member_2_id, relationship, start_date)
  VALUES (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000001',
    'bbbbbbbb-0000-0000-0000-000000000002',
    'spouse',
    '1910-06-01'
  ) ON CONFLICT DO NOTHING;

END $$;

-- =============================================================================
-- END OF MIGRATION 001
-- =============================================================================
-- Next migrations should cover:
--   002_indexes_and_search.sql    — Full-text search optimization
--   003_edge_functions_hooks.sql  — Birthday cron, notification triggers
--   004_storage_buckets.sql       — Supabase Storage bucket policies (if used)
-- =============================================================================
