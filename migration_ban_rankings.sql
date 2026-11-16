-- ==========================================================
-- МИГРАЦИЯ: баны пользователей (+ защита от самовыдачи админки)
-- Запусти ОДИН раз в Supabase → SQL Editor. Можно перезапускать, это безопасно.
-- Топ треков и рейтинг пользователей считаются на клиенте, SQL для них не нужен.
-- ==========================================================

-- 1. Колонки бана
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned   BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason  TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;  -- NULL = навсегда
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at   TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL;
UPDATE public.profiles SET is_banned = false WHERE is_banned IS NULL;

-- 2. «Я сейчас забанен?» (учитывает срок бана)
CREATE OR REPLACE FUNCTION public.is_banned()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_banned = true
      AND (banned_until IS NULL OR banned_until > NOW())
  );
$$;

-- 3. Защита служебных полей профиля.
--    ВАЖНО: раньше политика «Users update own profile» позволяла любому юзеру
--    выставить себе is_admin = true. Теперь эти поля может менять только админ.
CREATE OR REPLACE FUNCTION public.guard_profile_admin_fields() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE master_email CONSTANT TEXT := 'zahavalgovno777@gmail.com';
BEGIN
  -- SQL Editor / сервисная роль (auth.uid() пуст) — не ограничиваем
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  IF NOT public.is_site_admin() THEN
    IF NEW.is_admin     IS DISTINCT FROM OLD.is_admin
    OR NEW.is_banned    IS DISTINCT FROM OLD.is_banned
    OR NEW.ban_reason   IS DISTINCT FROM OLD.ban_reason
    OR NEW.banned_until IS DISTINCT FROM OLD.banned_until
    OR NEW.banned_at    IS DISTINCT FROM OLD.banned_at
    OR NEW.banned_by    IS DISTINCT FROM OLD.banned_by
    OR NEW.email        IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Недостаточно прав';
    END IF;
  END IF;

  IF NEW.is_banned IS DISTINCT FROM OLD.is_banned AND NEW.is_banned THEN
    IF LOWER(COALESCE(NEW.email, '')) = master_email THEN
      RAISE EXCEPTION 'Нельзя забанить главного админа';
    END IF;
    IF NEW.id = auth.uid() THEN
      RAISE EXCEPTION 'Нельзя забанить самого себя';
    END IF;
    IF COALESCE(NEW.is_admin, false) AND LOWER(COALESCE(auth.jwt() ->> 'email', '')) <> master_email THEN
      RAISE EXCEPTION 'Админа может забанить только главный админ';
    END IF;
    NEW.banned_at := NOW();
    NEW.banned_by := auth.uid();
  END IF;

  IF NEW.is_banned IS DISTINCT FROM OLD.is_banned AND NOT NEW.is_banned THEN
    NEW.ban_reason := NULL; NEW.banned_until := NULL; NEW.banned_at := NULL; NEW.banned_by := NULL;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_profile_fields ON public.profiles;
CREATE TRIGGER trg_guard_profile_fields BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_admin_fields();

-- 4. Забаненный не может писать (RESTRICTIVE = накладывается поверх существующих политик).
--    Удалять своё и писать в поддержку (reports) он по-прежнему может — чтобы подать апелляцию.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['ratings','replies','track_likes','comment_likes','reply_likes','playlists','playlist_tracks','messages']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "no_banned_insert" ON public.%I', t);
    EXECUTE format('CREATE POLICY "no_banned_insert" ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_banned())', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['ratings','replies','playlists']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "no_banned_update" ON public.%I', t);
    EXECUTE format('CREATE POLICY "no_banned_update" ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.is_banned())', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "no_banned_update" ON public.profiles;
CREATE POLICY "no_banned_update" ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_banned() OR public.is_site_admin());

-- 5. Уведомление о бане / разбане
CREATE OR REPLACE FUNCTION public.notify_on_ban_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_banned IS DISTINCT FROM OLD.is_banned THEN
    IF NEW.is_banned THEN
      INSERT INTO notifications (user_id, actor_id, type, message)
      VALUES (NEW.id, NEW.banned_by, 'banned',
        'Ваш аккаунт заблокирован' || CASE WHEN NEW.banned_until IS NULL THEN ' навсегда' ELSE ' до ' || to_char(NEW.banned_until, 'DD.MM.YYYY HH24:MI') END
        || COALESCE('. Причина: ' || NULLIF(NEW.ban_reason, ''), ''));
    ELSE
      INSERT INTO notifications (user_id, type, message) VALUES (NEW.id, 'unbanned', 'Блокировка снята. С возвращением!');
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_ban ON public.profiles;
CREATE TRIGGER trg_notify_ban AFTER UPDATE OF is_banned ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_ban_change();

NOTIFY pgrst, 'reload schema';
