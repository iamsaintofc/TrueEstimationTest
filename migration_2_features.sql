-- ==========================================================
-- МИГРАЦИЯ 2: приватность email, индексы, управление треками и файлами,
-- модерация комментариев, журнал банов, подписки.
-- Запусти ПОСЛЕ migration_ban_rankings.sql. Можно перезапускать.
-- ВАЖНО: не запускай заново старый «большой» скрипт схемы — его блок
-- «UPDATE profiles SET email = ...» снова сделает почты публичными.
-- ==========================================================

-- ---------- 1. ПРИВАТНОСТЬ EMAIL ----------
CREATE TABLE IF NOT EXISTS public.profile_private (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT
);
ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pp_select_own_or_admin" ON public.profile_private;
CREATE POLICY "pp_select_own_or_admin" ON public.profile_private
    FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_site_admin());
-- INSERT/UPDATE с клиента запрещены: таблицу ведёт только триггер ниже.

INSERT INTO public.profile_private (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'username', 'User_' || substr(new.id::text, 1, 4)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile_private (id, email) VALUES (new.id, new.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN new;
END $$;

-- Сторож профиля: теперь главного админа определяем по auth.users, а не по profiles.email
CREATE OR REPLACE FUNCTION public.guard_profile_admin_fields() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE master_email CONSTANT TEXT := 'zahavalgovno777@gmail.com'; target_is_master BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NOT public.is_site_admin() THEN
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
    OR NEW.ban_reason IS DISTINCT FROM OLD.ban_reason OR NEW.banned_until IS DISTINCT FROM OLD.banned_until
    OR NEW.banned_at IS DISTINCT FROM OLD.banned_at OR NEW.banned_by IS DISTINCT FROM OLD.banned_by
    OR NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Недостаточно прав';
    END IF;
  END IF;
  IF NEW.is_banned IS DISTINCT FROM OLD.is_banned AND NEW.is_banned THEN
    SELECT LOWER(COALESCE(u.email, '')) = master_email INTO target_is_master FROM auth.users u WHERE u.id = NEW.id;
    IF COALESCE(target_is_master, false) THEN RAISE EXCEPTION 'Нельзя забанить главного админа'; END IF;
    IF NEW.id = auth.uid() THEN RAISE EXCEPTION 'Нельзя забанить самого себя'; END IF;
    IF COALESCE(NEW.is_admin, false) AND LOWER(COALESCE(auth.jwt() ->> 'email', '')) <> master_email THEN
      RAISE EXCEPTION 'Админа может забанить только главный админ';
    END IF;
    NEW.banned_at := NOW(); NEW.banned_by := auth.uid();
  END IF;
  IF NEW.is_banned IS DISTINCT FROM OLD.is_banned AND NOT NEW.is_banned THEN
    NEW.ban_reason := NULL; NEW.banned_until := NULL; NEW.banned_at := NULL; NEW.banned_by := NULL;
  END IF;
  RETURN NEW;
END $$;

-- Убираем почты из публичной таблицы (теперь они только в profile_private)
UPDATE public.profiles SET email = NULL WHERE email IS NOT NULL;

-- ---------- 2. ИНДЕКСЫ (ускоряют выборки при росте данных) ----------
CREATE INDEX IF NOT EXISTS ratings_track_idx       ON public.ratings (track_id);
CREATE INDEX IF NOT EXISTS ratings_user_idx        ON public.ratings (user_id);
CREATE INDEX IF NOT EXISTS ratings_created_idx     ON public.ratings (created_at DESC);
CREATE INDEX IF NOT EXISTS track_likes_track_idx   ON public.track_likes (track_id);
CREATE INDEX IF NOT EXISTS track_likes_user_idx    ON public.track_likes (user_id);
CREATE INDEX IF NOT EXISTS comment_likes_rating_idx ON public.comment_likes (rating_id);
CREATE INDEX IF NOT EXISTS reply_likes_reply_idx   ON public.reply_likes (reply_id);
CREATE INDEX IF NOT EXISTS replies_rating_idx      ON public.replies (rating_id);
CREATE INDEX IF NOT EXISTS playlist_tracks_pl_idx  ON public.playlist_tracks (playlist_id);
CREATE INDEX IF NOT EXISTS reports_user_idx        ON public.reports (user_id);

-- ---------- 3. УПРАВЛЕНИЕ ТРЕКАМИ + ХРАНИЛИЩЕ ФАЙЛОВ ----------
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone view tracks"    ON public.tracks;
DROP POLICY IF EXISTS "Admins insert tracks"  ON public.tracks;
DROP POLICY IF EXISTS "Admins update tracks"  ON public.tracks;
DROP POLICY IF EXISTS "Admins delete tracks"  ON public.tracks;
CREATE POLICY "Anyone view tracks"   ON public.tracks FOR SELECT USING (true);
CREATE POLICY "Admins insert tracks" ON public.tracks FOR INSERT WITH CHECK (public.is_site_admin());
CREATE POLICY "Admins update tracks" ON public.tracks FOR UPDATE USING (public.is_site_admin()) WITH CHECK (public.is_site_admin());
CREATE POLICY "Admins delete tracks" ON public.tracks FOR DELETE USING (public.is_site_admin());

INSERT INTO storage.buckets (id, name, public) VALUES ('track-media', 'track-media', true) ON CONFLICT DO NOTHING;
DROP POLICY IF EXISTS "track_media_read"   ON storage.objects;
DROP POLICY IF EXISTS "track_media_insert" ON storage.objects;
DROP POLICY IF EXISTS "track_media_update" ON storage.objects;
DROP POLICY IF EXISTS "track_media_delete" ON storage.objects;
CREATE POLICY "track_media_read"   ON storage.objects FOR SELECT USING (bucket_id = 'track-media');
CREATE POLICY "track_media_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'track-media' AND public.is_site_admin());
CREATE POLICY "track_media_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'track-media' AND public.is_site_admin());
CREATE POLICY "track_media_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'track-media' AND public.is_site_admin());

-- ---------- 4. МОДЕРАЦИЯ ----------
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS target_rating_id BIGINT;
ALTER TABLE public.ratings ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Admin update any rating" ON public.ratings;
CREATE POLICY "Admin update any rating" ON public.ratings FOR UPDATE USING (public.is_site_admin()) WITH CHECK (public.is_site_admin());

-- 4.1 Только админ может скрывать/показывать комментарий (авто-скрытие обходит флагом)
CREATE OR REPLACE FUNCTION public.guard_rating_hidden() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.hidden IS DISTINCT FROM OLD.hidden AND auth.uid() IS NOT NULL
     AND COALESCE(current_setting('app.bypass_guard', true), '') <> '1' AND NOT public.is_site_admin() THEN
    NEW.hidden := OLD.hidden;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_rating_hidden ON public.ratings;
CREATE TRIGGER trg_guard_rating_hidden BEFORE UPDATE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.guard_rating_hidden();

-- 4.2 Автоскрытие: 3 разных пользователя пожаловались на один комментарий
CREATE OR REPLACE FUNCTION public.auto_hide_reported() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.target_rating_id IS NOT NULL
     AND (SELECT COUNT(DISTINCT user_id) FROM reports WHERE target_rating_id = NEW.target_rating_id) >= 3 THEN
    PERFORM set_config('app.bypass_guard', '1', true);
    UPDATE ratings SET hidden = true WHERE id = NEW.target_rating_id AND NOT hidden;
    PERFORM set_config('app.bypass_guard', '', true);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_auto_hide ON public.reports;
CREATE TRIGGER trg_auto_hide AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.auto_hide_reported();

-- 4.3 Лимиты частоты: оценки (20/мин), ответы (10/мин)
CREATE OR REPLACE FUNCTION public.ratings_rate_limit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT COUNT(*) FROM ratings WHERE user_id = NEW.user_id AND created_at > NOW() - INTERVAL '1 minute') >= 20 THEN
    RAISE EXCEPTION 'Слишком часто. Подожди минуту';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_ratings_rate_limit ON public.ratings;
CREATE TRIGGER trg_ratings_rate_limit BEFORE INSERT ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.ratings_rate_limit();

CREATE OR REPLACE FUNCTION public.replies_rate_limit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT COUNT(*) FROM replies WHERE user_id = NEW.user_id AND created_at > NOW() - INTERVAL '1 minute') >= 10 THEN
    RAISE EXCEPTION 'Слишком часто. Подожди минуту';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_replies_rate_limit ON public.replies;
CREATE TRIGGER trg_replies_rate_limit BEFORE INSERT ON public.replies
  FOR EACH ROW EXECUTE FUNCTION public.replies_rate_limit();

-- 4.4 Журнал банов (видят только админы, пишет только триггер)
CREATE TABLE IF NOT EXISTS public.ban_log (
    id BIGSERIAL PRIMARY KEY,
    target_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,            -- ban | unban
    reason TEXT,
    banned_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.ban_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ban_log_admin_select" ON public.ban_log;
CREATE POLICY "ban_log_admin_select" ON public.ban_log FOR SELECT TO authenticated USING (public.is_site_admin());

CREATE OR REPLACE FUNCTION public.log_ban_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_banned IS DISTINCT FROM OLD.is_banned THEN
    INSERT INTO ban_log (target_id, admin_id, action, reason, banned_until)
    VALUES (NEW.id, auth.uid(), CASE WHEN NEW.is_banned THEN 'ban' ELSE 'unban' END,
            CASE WHEN NEW.is_banned THEN NEW.ban_reason END, CASE WHEN NEW.is_banned THEN NEW.banned_until END);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_log_ban ON public.profiles;
CREATE TRIGGER trg_log_ban AFTER UPDATE OF is_banned ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_ban_change();

-- ---------- 5. ПОДПИСКИ ----------
CREATE TABLE IF NOT EXISTS public.follows (
    follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    followed_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_id, followed_id),
    CHECK (follower_id <> followed_id)
);
CREATE INDEX IF NOT EXISTS follows_followed_idx ON public.follows (followed_id);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "follows_select" ON public.follows;
DROP POLICY IF EXISTS "follows_insert_own" ON public.follows;
DROP POLICY IF EXISTS "follows_delete_own" ON public.follows;
DROP POLICY IF EXISTS "no_banned_insert" ON public.follows;
CREATE POLICY "follows_select"     ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_insert_own" ON public.follows FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid());
CREATE POLICY "follows_delete_own" ON public.follows FOR DELETE TO authenticated USING (follower_id = auth.uid());
CREATE POLICY "no_banned_insert"   ON public.follows AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_banned());

CREATE OR REPLACE FUNCTION public.notify_on_follow() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM notifications WHERE user_id = NEW.followed_id AND actor_id = NEW.follower_id AND type = 'follow') THEN
    RETURN NEW;  -- повторная подписка не спамит
  END IF;
  SELECT username INTO actor FROM profiles WHERE id = NEW.follower_id;
  INSERT INTO notifications (user_id, actor_id, type, ref_id, message)
  VALUES (NEW.followed_id, NEW.follower_id, 'follow', NULL, COALESCE(actor, 'Кто-то') || ' подписался на вас');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_follow ON public.follows;
CREATE TRIGGER trg_notify_follow AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

NOTIFY pgrst, 'reload schema';
