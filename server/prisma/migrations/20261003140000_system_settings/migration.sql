-- CreateTable
CREATE TABLE "system_settings" (
    "setting_key" TEXT NOT NULL,
    "setting_value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("setting_key")
);
