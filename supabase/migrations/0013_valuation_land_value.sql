-- =====================================================================
-- 0013_valuation_land_value
-- Bodenwert pro Bewertung erfassbar machen.
--
-- Hintergrund: Bisher kam der Bodenwert für den Substanzwert aus
-- properties.land_value (historischer Wert zum Anschaffungszeitpunkt,
-- relevant für AfA nach § 7 EStG). Bodenrichtwerte ändern sich aber über
-- die Zeit — der Substanzwert einer Bewertung muss den jeweiligen
-- Bodenmarktwert zum Bewertungsstichtag nutzen können.
--
-- Neues Feld portfolio_valuations.land_value (€, nullable):
--   - leer  → Fallback auf properties.land_value (Stammdaten)
--   - gesetzt → übersteuert den Property-Bodenwert für den Substanzwert
--     dieser Bewertung. AfA-Berechnung bleibt unberührt (zieht weiter
--     properties.land_value).
-- =====================================================================

alter table public.portfolio_valuations
  add column if not exists land_value numeric(12,2);

comment on column public.portfolio_valuations.land_value is
  'Bodenmarktwert (€) zum Bewertungsstichtag. Leer = Fallback auf properties.land_value. Nicht AfA-relevant.';
