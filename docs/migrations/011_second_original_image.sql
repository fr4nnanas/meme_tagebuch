-- Zweites Referenzfoto pro Post (optional, Upload mit zwei Zuschnitten).
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS original_image_url_2 text;
