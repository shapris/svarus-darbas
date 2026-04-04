-- Diagnostika: CRM lentelė public.memories (įmonės / asistento užrašai).
-- Vykdykite Supabase → SQL Editor (projekto savininkas). AI neturi prieigos prie jūsų DB.

-- A) Kiek įrašų (visada saugu)
SELECT count(*) AS memories_total FROM public.memories;

-- B) Kokie stulpeliai pas jus (pagal rezultatą žinokite schemą)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'memories'
ORDER BY ordinal_position;

-- C1) Jei yra stulpelis owner_id (nauja schema) — paskutiniai įrašai
-- SELECT id, owner_id, left(content, 150) AS preview, type, created_at
-- FROM public.memories
-- ORDER BY created_at DESC NULLS LAST
-- LIMIT 25;

-- C2) Jei yra stulpelis uid (sena schema, camelCase) — atkomentuokite ir vykdykite
-- SELECT id, uid, left(content, 150) AS preview, category, "createdAt"
-- FROM public.memories
-- ORDER BY "createdAt" DESC NULLS LAST
-- LIMIT 25;

-- D) Paieška tekste (pakeiskite žodį)
-- SELECT id, left(content, 300) FROM public.memories WHERE content ILIKE '%žodis%';
