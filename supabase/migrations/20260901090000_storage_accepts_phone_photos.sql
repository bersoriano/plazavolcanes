-- Pictures now go straight from the browser to storage, without being
-- re-encoded on the device first. Decoding a 24-megapixel phone photo cost
-- around 97 MB of memory, which was enough for a mobile browser to kill the
-- tab, so the bucket has to accept what a phone actually produces.

update storage.buckets
set file_size_limit = 12582912
where id = 'catalogo';

-- Rollback:
--   update storage.buckets set file_size_limit = 5242880 where id = 'catalogo';
