-- Fix Issue 1: Restrict profiles table to only allow users to view their own profile
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Fix Issue 2: Create a view for storage_credentials that excludes sensitive key data
-- Users can query the view to get account info without exposing encryption keys
CREATE VIEW public.storage_credentials_safe
WITH (security_invoker=on) AS
SELECT 
  id,
  user_id,
  name,
  url_endpoint,
  is_active,
  created_at,
  updated_at
FROM public.storage_credentials;
-- Note: private_key_encrypted and public_key are excluded from this view

-- Add file size and type constraints to files table for defense in depth
ALTER TABLE public.files 
ADD CONSTRAINT check_file_size CHECK (size >= 0 AND size <= 52428800); -- Max 50MB

-- Add allowed file types constraint
ALTER TABLE public.files
ADD CONSTRAINT check_file_type CHECK (
  file_type IS NULL OR 
  file_type IN (
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv',
    'video/mp4', 'video/webm',
    'audio/mpeg', 'audio/wav'
  )
);