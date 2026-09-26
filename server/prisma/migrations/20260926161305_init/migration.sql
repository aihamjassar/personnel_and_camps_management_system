-- CreateTable
CREATE TABLE "users" (
    "user_id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "roles" (
    "role_id" SERIAL NOT NULL,
    "role_name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "permission_id" SERIAL NOT NULL,
    "permission_key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "personnel" (
    "personnel_id" SERIAL NOT NULL,
    "full_name" TEXT NOT NULL,
    "national_id" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "gender" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "rank_id" INTEGER,
    "unit_id" INTEGER,
    "camp_id" INTEGER,
    "current_status" TEXT NOT NULL DEFAULT 'active',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personnel_pkey" PRIMARY KEY ("personnel_id")
);

-- CreateTable
CREATE TABLE "camps" (
    "camp_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camps_pkey" PRIMARY KEY ("camp_id")
);

-- CreateTable
CREATE TABLE "organizational_units" (
    "unit_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "camp_id" INTEGER NOT NULL,
    "parent_unit_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizational_units_pkey" PRIMARY KEY ("unit_id")
);

-- CreateTable
CREATE TABLE "ranks" (
    "rank_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "description" TEXT,

    CONSTRAINT "ranks_pkey" PRIMARY KEY ("rank_id")
);

-- CreateTable
CREATE TABLE "positions" (
    "position_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "unit_id" INTEGER,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("position_id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "assignment_id" SERIAL NOT NULL,
    "personnel_id" INTEGER NOT NULL,
    "unit_id" INTEGER NOT NULL,
    "position_id" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("assignment_id")
);

-- CreateTable
CREATE TABLE "transfers" (
    "transfer_id" SERIAL NOT NULL,
    "personnel_id" INTEGER NOT NULL,
    "camp_from_id" INTEGER NOT NULL,
    "camp_to_id" INTEGER NOT NULL,
    "requested_by" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("transfer_id")
);

-- CreateTable
CREATE TABLE "personnel_status" (
    "status_id" SERIAL NOT NULL,
    "personnel_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "changed_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personnel_status_pkey" PRIMARY KEY ("status_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "log_id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action_type" TEXT NOT NULL,
    "target_table" TEXT NOT NULL,
    "target_id" INTEGER,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "notification_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "roles_role_name_key" ON "roles"("role_name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_permission_key_key" ON "permissions"("permission_key");

-- CreateIndex
CREATE UNIQUE INDEX "personnel_national_id_key" ON "personnel"("national_id");

-- CreateIndex
CREATE INDEX "personnel_camp_id_idx" ON "personnel"("camp_id");

-- CreateIndex
CREATE INDEX "personnel_unit_id_idx" ON "personnel"("unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "camps_name_key" ON "camps"("name");

-- CreateIndex
CREATE INDEX "organizational_units_camp_id_idx" ON "organizational_units"("camp_id");

-- CreateIndex
CREATE UNIQUE INDEX "ranks_name_key" ON "ranks"("name");

-- CreateIndex
CREATE INDEX "assignments_personnel_id_idx" ON "assignments"("personnel_id");

-- CreateIndex
CREATE INDEX "transfers_personnel_id_idx" ON "transfers"("personnel_id");

-- CreateIndex
CREATE INDEX "personnel_status_personnel_id_idx" ON "personnel_status"("personnel_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_target_table_idx" ON "audit_logs"("target_table");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("permission_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_rank_id_fkey" FOREIGN KEY ("rank_id") REFERENCES "ranks"("rank_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "organizational_units"("unit_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel" ADD CONSTRAINT "personnel_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("camp_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizational_units" ADD CONSTRAINT "organizational_units_camp_id_fkey" FOREIGN KEY ("camp_id") REFERENCES "camps"("camp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizational_units" ADD CONSTRAINT "organizational_units_parent_unit_id_fkey" FOREIGN KEY ("parent_unit_id") REFERENCES "organizational_units"("unit_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "organizational_units"("unit_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("personnel_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "organizational_units"("unit_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("position_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("personnel_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_camp_from_id_fkey" FOREIGN KEY ("camp_from_id") REFERENCES "camps"("camp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_camp_to_id_fkey" FOREIGN KEY ("camp_to_id") REFERENCES "camps"("camp_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel_status" ADD CONSTRAINT "personnel_status_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("personnel_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personnel_status" ADD CONSTRAINT "personnel_status_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
