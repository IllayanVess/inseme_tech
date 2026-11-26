CREATE TABLE public.ai_watch_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  keyword text NOT NULL
    CHECK (keyword = btrim(keyword) AND char_length(keyword) BETWEEN 2 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ai_watch_keywords_user_keyword_uidx
  ON public.ai_watch_keywords (user_id, lower(keyword));
CREATE INDEX ai_watch_keywords_user_created_idx
  ON public.ai_watch_keywords (user_id, created_at DESC);

CREATE FUNCTION public.enforce_ai_watch_keyword_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  current_count integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.user_id::text, 0)
  );

  SELECT pg_catalog.count(*)
    INTO current_count
    FROM public.ai_watch_keywords
    WHERE user_id = NEW.user_id;

  IF current_count >= 20 THEN
    RAISE EXCEPTION 'Each account can track up to 20 AI watch keywords.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER ai_watch_keywords_limit_before_insert
  BEFORE INSERT ON public.ai_watch_keywords
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ai_watch_keyword_limit();

CREATE TABLE public.ai_watch_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE
    CHECK (endpoint ~ '^https://' AND char_length(endpoint) BETWEEN 16 AND 2048),
  p256dh text NOT NULL CHECK (char_length(p256dh) BETWEEN 32 AND 160),
  auth text NOT NULL CHECK (char_length(auth) BETWEEN 16 AND 160),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);

CREATE INDEX ai_watch_subscriptions_user_idx
  ON public.ai_watch_subscriptions (user_id);

CREATE TABLE public.ai_watch_deliveries (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL,
  article_key text NOT NULL CHECK (article_key ~ '^[0-9a-f]{64}$'),
  delivered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, subscription_id, article_key),
  FOREIGN KEY (subscription_id, user_id)
    REFERENCES public.ai_watch_subscriptions (id, user_id)
    ON DELETE CASCADE
);

ALTER TABLE public.ai_watch_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_watch_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_watch_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read their AI watch keywords"
  ON public.ai_watch_keywords FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Members add their AI watch keywords"
  ON public.ai_watch_keywords FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Members remove their AI watch keywords"
  ON public.ai_watch_keywords FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Members read their AI watch subscriptions"
  ON public.ai_watch_subscriptions FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Members add their AI watch subscriptions"
  ON public.ai_watch_subscriptions FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Members remove their AI watch subscriptions"
  ON public.ai_watch_subscriptions FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.ai_watch_keywords, public.ai_watch_subscriptions,
  public.ai_watch_deliveries FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON public.ai_watch_keywords,
  public.ai_watch_subscriptions TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.ai_watch_keywords,
  public.ai_watch_subscriptions TO service_role;
GRANT SELECT, INSERT, DELETE ON public.ai_watch_deliveries TO service_role;
REVOKE ALL ON FUNCTION public.enforce_ai_watch_keyword_limit()
  FROM PUBLIC, anon, authenticated, service_role;
