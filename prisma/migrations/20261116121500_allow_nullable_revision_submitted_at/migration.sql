-- Update CourseRevision defaults and nullable submission timestamp.
ALTER TABLE "CourseRevision"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT',
  ALTER COLUMN "submittedAt" DROP DEFAULT,
  ALTER COLUMN "submittedAt" DROP NOT NULL;
