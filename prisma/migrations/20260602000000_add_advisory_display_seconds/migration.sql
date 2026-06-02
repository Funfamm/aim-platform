-- Add admin-configurable display duration for the Content Advisory overlay
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "advisoryDisplaySeconds" INTEGER;
