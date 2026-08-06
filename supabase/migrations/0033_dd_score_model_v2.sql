-- =====================================================================
-- 0033_dd_score_model_v2
-- Zweite Fassung des Score-Modells.
--
-- Drei Änderungen, die Persistenz brauchen:
--
-- 1. `dd_findings.status` — offen / zu_belegen / erledigt. Bisher konnte
--    ein Finding nur „existieren"; ob es bereits erledigt oder durch
--    eine unbelegte Zusage entschärft war, ließ sich nicht ausdrücken.
--    Der Score zog deshalb auch für längst bezahlte Sonderumlagen ab.
--
-- 2. `dd_projects.score_condition` / `score_price` — der eine Gesamtscore
--    vermischte „ist das Objekt in Ordnung" mit „stimmt der Preis". Das
--    erste ist nicht verhandelbar, das zweite ist genau das, wofür es
--    das Verhandlungsdossier gibt.
--
-- 3. Kategorien ohne auswertbare Quelle werden nicht mehr bewertet.
--    Das braucht keine Spalte — `score_by_category` ist jsonb und
--    trägt jetzt `score: null` für solche Kategorien.
--
-- Bestehende Analysen behalten ihre alten Zahlen, bis sie neu gerechnet
-- werden. Die Werte sind zwischen Fassung 1 und 2 NICHT vergleichbar.
-- =====================================================================

alter table public.dd_findings
  add column if not exists status text not null default 'offen'
    check (status in ('offen', 'zu_belegen', 'erledigt'));

comment on column public.dd_findings.status is
  'offen | zu_belegen | erledigt — erledigt verlangt einen Beleg, eine mündliche Zusage ist zu_belegen. Steuert die Score-Wirkung.';

alter table public.dd_projects
  add column if not exists score_condition integer
    check (score_condition is null or (score_condition between 0 and 100)),
  add column if not exists score_price integer
    check (score_price is null or (score_price between 0 and 100));

comment on column public.dd_projects.score_condition is
  'Objektzustand 0..100 (Substanz, WEG, Recht, Energie) — nicht verhandelbar.';
comment on column public.dd_projects.score_price is
  'Preiswürdigkeit 0..100 (Rentabilität, Markt, Lage) — die Verhandlungsseite.';
