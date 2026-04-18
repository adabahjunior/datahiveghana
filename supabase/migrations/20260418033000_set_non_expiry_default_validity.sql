-- Set all existing package validity values to Non-Expiry (NULL).
UPDATE public.data_packages
SET validity_days = NULL
WHERE validity_days IS NOT NULL;
