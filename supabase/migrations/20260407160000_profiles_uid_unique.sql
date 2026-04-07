-- Stabilumas: užtikrinti, kad public.profiles.uid būtų unikalus.
-- Reikalinga patikimam ON CONFLICT (uid) veikimui.

-- 1) Pašalinti dublikatus, paliekant naujausią įrašą pagal uid.
WITH ranked AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY uid::text
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.profiles
)
DELETE FROM public.profiles p
USING ranked r
WHERE p.ctid = r.ctid
  AND r.rn > 1;

-- 2) Užtikrinti unikalumą DB lygyje.
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_uid_unique ON public.profiles(uid);
