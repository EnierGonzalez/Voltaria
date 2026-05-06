"use client";

import { useMemo, useState, useTransition } from "react";
import { KeyRound, Plus, RotateCcw, ShieldCheck, UserRound } from "lucide-react";
import type { AppRole, ResidentSummary } from "@voltaria/shared";
import type { AppUserSummary } from "@voltaria/db";
import { SectionCard, StatusBadge, cn } from "@voltaria/ui";
import {
  createUserAction,
  resetTemporaryPasswordAction,
  updateUserRoleAction,
  updateUserStatusAction
} from "@/lib/actions/user-actions";

const roleOptions: Array<{ value: AppRole; label: string }> = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "operations", label: "Operación" },
  { value: "accounting", label: "Contabilidad" },
  { value: "auditor", label: "Auditor" },
  { value: "resident", label: "Residente" },
  { value: "support", label: "Soporte" }
];

export function UserManagement({
  users,
  residents,
  propertyId
}: {
  users: AppUserSummary[];
  residents: ResidentSummary[];
  propertyId: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    userType: "staff",
    role: "operations" as AppRole,
    residentId: ""
  });

  const selectedResident = useMemo(
    () => residents.find((resident) => resident.id === form.residentId),
    [form.residentId, residents]
  );

  function createUser() {
    if (!propertyId) {
      setMessage("No hay propiedad activa.");
      return;
    }

    const nextPassword = generateTemporaryPassword();
    setTemporaryPassword(nextPassword);
    setMessage(null);

    startTransition(async () => {
      const result = await createUserAction({
        propertyId,
        fullName: form.fullName,
        email: form.email,
        phone: form.phone || undefined,
        userType: form.role === "resident" ? "resident" : form.userType,
        role: form.role,
        residentId: form.role === "resident" && form.residentId ? form.residentId : undefined,
        temporaryPassword: nextPassword,
        status: "active"
      });
      setMessage(result.message ?? result.error ?? null);
    });
  }

  function updateRole(membershipId: string | null, role: AppRole) {
    if (!membershipId) {
      setMessage("El usuario no tiene membresía activa en esta propiedad.");
      return;
    }

    startTransition(async () => {
      const result = await updateUserRoleAction({ membershipId, role });
      setMessage(result.message ?? result.error ?? null);
    });
  }

  function updateStatus(userId: string, status: "active" | "suspended" | "disabled") {
    startTransition(async () => {
      const result = await updateUserStatusAction({ userId, status, reason: "admin_update" });
      setMessage(result.message ?? result.error ?? null);
    });
  }

  function resetPassword(userId: string) {
    const nextPassword = generateTemporaryPassword();
    setTemporaryPassword(nextPassword);
    startTransition(async () => {
      const result = await resetTemporaryPasswordAction({
        userId,
        temporaryPassword: nextPassword
      });
      setMessage(result.message ?? result.error ?? null);
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <SectionCard
        title="Usuarios"
        description="Acceso interno por rol y propiedad."
        action={<StatusBadge variant="info">{users.length} usuarios</StatusBadge>}
      >
        <div className="space-y-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="grid gap-3 rounded-lg border border-border bg-panel2 p-4 md:grid-cols-[minmax(0,1fr)_190px_190px]"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <UserRound className="h-4 w-4 shrink-0 text-cyan" aria-hidden="true" />
                  <p className="truncate text-sm font-semibold text-foreground">{user.fullName}</p>
                  <StatusBadge variant={user.status === "active" ? "success" : "warning"}>
                    {user.status}
                  </StatusBadge>
                </div>
                <p className="mt-1 truncate text-sm text-muted">{user.email}</p>
                <p className="mt-2 truncate text-xs text-muted">
                  {user.propertyName ?? "Sin propiedad"} · {user.residentName ?? user.userType}
                  {user.apartmentNumber ? ` · Depto ${user.apartmentNumber}` : ""}
                </p>
              </div>

              <div className="min-w-0">
                <label className="text-xs font-medium text-muted">Rol</label>
                <select
                  value={user.role ?? "support"}
                  onChange={(event) => updateRole(user.membershipId, event.target.value as AppRole)}
                  className="mt-2 h-9 w-full rounded-md border border-border bg-panel px-2 text-sm text-foreground"
                >
                  {roleOptions.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex min-w-0 flex-wrap items-end gap-2">
                <button
                  type="button"
                  onClick={() => resetPassword(user.id)}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm text-muted transition hover:border-primary/60 hover:text-foreground"
                >
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  Reset
                </button>
                {user.status === "active" ? (
                  <button
                    type="button"
                    onClick={() => updateStatus(user.id, "suspended")}
                    className="inline-flex h-9 items-center rounded-md border border-warning/35 px-3 text-sm text-warning transition hover:bg-warning/10"
                  >
                    Suspender
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => updateStatus(user.id, "active")}
                    className="inline-flex h-9 items-center rounded-md border border-success/35 px-3 text-sm text-success transition hover:bg-success/10"
                  >
                    Activar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Nuevo usuario" description="La contraseña temporal se muestra una sola vez.">
        <div className="space-y-4">
          <TextInput
            label="Nombre"
            value={form.fullName}
            onChange={(value) => setForm((current) => ({ ...current, fullName: value }))}
          />
          <TextInput
            label="Correo"
            type="email"
            value={form.email}
            onChange={(value) => setForm((current) => ({ ...current, email: value }))}
          />
          <TextInput
            label="Teléfono"
            value={form.phone}
            onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Tipo"
              value={form.userType}
              onChange={(value) => setForm((current) => ({ ...current, userType: value }))}
              options={[
                { value: "staff", label: "Staff" },
                { value: "resident", label: "Residente" },
                { value: "service", label: "Servicio" }
              ]}
            />
            <Select
              label="Rol"
              value={form.role}
              onChange={(value) => setForm((current) => ({ ...current, role: value as AppRole }))}
              options={roleOptions}
            />
          </div>

          {form.role === "resident" ? (
            <Select
              label="Residente"
              value={form.residentId}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  residentId: value,
                  fullName: residents.find((resident) => resident.id === value)?.name ?? current.fullName,
                  email: residents.find((resident) => resident.id === value)?.email ?? current.email
                }))
              }
              options={[
                { value: "", label: "Seleccionar" },
                ...residents.map((resident) => ({
                  value: resident.id,
                  label: `${resident.name} · ${resident.apartmentNumber}`
                }))
              ]}
            />
          ) : null}

          {selectedResident ? (
            <p className="rounded-md border border-cyan/20 bg-cyan/10 px-3 py-2 text-xs text-cyan">
              Se vinculará a {selectedResident.name}, depto {selectedResident.apartmentNumber}.
            </p>
          ) : null}

          {temporaryPassword ? (
            <div className="rounded-md border border-warning/30 bg-warning/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-warning">
                Contraseña temporal
              </p>
              <p className="mt-2 break-all font-mono text-sm text-foreground">{temporaryPassword}</p>
            </div>
          ) : null}

          {message ? (
            <p
              className={cn(
                "rounded-md border px-3 py-2 text-sm",
                message.includes("No ") || message.includes("inválid")
                  ? "border-error/30 bg-error/10 text-error"
                  : "border-success/30 bg-success/10 text-success"
              )}
            >
              {message}
            </p>
          ) : null}

          <button
            type="button"
            onClick={createUser}
            disabled={isPending}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? (
              <RotateCcw className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="h-4 w-4" aria-hidden="true" />
            )}
            Crear usuario
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-border bg-panel2 px-3 text-sm text-foreground outline-none transition focus:border-primary"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-border bg-panel2 px-3 text-sm text-foreground outline-none transition focus:border-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function generateTemporaryPassword() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 10);
  return `Voltaria2026${suffix}`;
}
