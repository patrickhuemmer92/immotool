-- ---------------------------------------------------------------------
-- Storage-Bucket dd-documents: MIME-Whitelist um Word-Formate erweitern.
--
-- Grund: viele Verträge (Kaufvertrag, Mietvertrag, Darlehen) kommen als
-- .docx / .doc rein. Bislang blockt der Bucket sie mit 400 auf Upload.
-- Wir extrahieren DOCX serverseitig via mammoth (Text-only, kein Vision).
-- ---------------------------------------------------------------------

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', -- .docx
  'application/msword',                                                       -- .doc (Legacy)
  'image/jpeg',
  'image/png',
  'image/webp'
]
where id = 'dd-documents';
