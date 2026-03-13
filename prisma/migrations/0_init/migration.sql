-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "date" TEXT,
    "participants" TEXT,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "audio_path" TEXT,
    "audio_duration" REAL,
    "transcript" TEXT,
    "summary" TEXT,
    "thinking_content" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "current_step" TEXT,
    "error" TEXT,
    "asr_job_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

