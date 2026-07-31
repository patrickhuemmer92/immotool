-- =====================================================================
-- 0031_owner_tax_rate
-- Persönlicher Steuersatz je Eigentümer-Entität.
--
-- Bisher gab es genau einen Satz pro Workspace (settings.tax_rate). Das
-- unterstellt implizit eine einzige steuerliche Situation — funktioniert
-- nur, solange alle Objekte demselben Steuersubjekt gehören (z. B. einem
-- zusammen veranlagten Ehepaar). Bei nicht verheirateten Miteigentümern
-- hat jeder seinen eigenen Grenzsteuersatz.
--
-- Der Satz hängt an der Entität `owners`, nicht an `owner_members`:
--   kind = 'person'  → individueller Satz (Grundtabelle)
--   kind = 'group'   → Satz des gemeinsamen Steuersubjekts
--                      (Zusammenveranlagung / Splitting)
--
-- NULL = "kein eigener Satz" → Fallback auf settings.tax_rate. Damit
-- bleiben bestehende Workspaces rechnerisch unverändert, bis jemand
-- einen Satz setzt.
--
-- Wirkung in den Berechnungen: pro Objekt wird aus den Anteilen ein
-- Mischsatz gebildet — Σ (property_owners.ownership_share × Satz des
-- Eigentümers). Siehe src/lib/calculations/owner-tax.ts.
-- =====================================================================

alter table public.owners
  add column if not exists tax_rate numeric(5,4)
    check (tax_rate is null or (tax_rate >= 0 and tax_rate <= 1));

comment on column public.owners.tax_rate is
  'Persönlicher Grenzsteuersatz als Dezimalwert (0.42 = 42 %). NULL = Fallback auf settings.tax_rate des Workspace.';
