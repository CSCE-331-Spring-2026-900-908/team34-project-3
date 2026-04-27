"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ManagerFilterBar,
  ManagerPaneHeader,
  ManagerScrollArea,
  ManagerSelect
} from "@/components/manager-primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EmployeeRecord } from "@/lib/types";

type Props = {
  employees: EmployeeRecord[];
};

export function EmployeeManagementClient({ employees }: Props) {
  const router = useRouter();
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isManager, setIsManager] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "manager" | "cashier">("all");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const matchesRole =
        roleFilter === "all" ||
        (roleFilter === "manager" ? employee.isManager : !employee.isManager);

      if (!matchesRole) {
        return false;
      }

      if (!deferredQuery) {
        return true;
      }

      const haystack = [
        employee.firstName,
        employee.lastName,
        employee.email ?? "",
        String(employee.employeeId)
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(deferredQuery);
    });
  }, [deferredQuery, employees, roleFilter]);

  function selectEmployee(employee: EmployeeRecord) {
    setSelectedEmployee(employee);
    setFirstName(employee.firstName);
    setLastName(employee.lastName);
    setEmail(employee.email ?? "");
    setPassword(employee.password == null ? "" : String(employee.password));
    setIsManager(employee.isManager);
  }

  function clearForm() {
    setSelectedEmployee(null);
    setFirstName("");
    setLastName("");
    setEmail("");
    setPassword("");
    setIsManager(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const numericPassword = Number(password.trim());

    if (!trimmedFirst || !trimmedLast || !trimmedEmail) {
      toast.error("First name, last name, and email are required.");
      return;
    }

    if (!/^\d{4}$/.test(password.trim()) || !Number.isInteger(numericPassword)) {
      toast.error("PIN must be exactly 4 digits.");
      return;
    }

    setSubmitting(true);

    const body = {
      firstName: trimmedFirst,
      lastName: trimmedLast,
      email: trimmedEmail,
      isManager,
      password: numericPassword
    };

    const url = selectedEmployee
      ? `/api/employees/${selectedEmployee.employeeId}`
      : "/api/employees";

    const method = selectedEmployee ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    setSubmitting(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(payload?.error ?? "Failed to save employee.");
      return;
    }

    toast.success(selectedEmployee ? "Employee updated." : "Employee created.");
    clearForm();
    router.refresh();
  }

  async function handleDelete() {
    if (!selectedEmployee || deleting) {
      return;
    }

    const confirmed = window.confirm(`Delete employee #${selectedEmployee.employeeId}?`);

    if (!confirmed) {
      return;
    }

    setDeleting(true);

    const response = await fetch(`/api/employees/${selectedEmployee.employeeId}`, {
      method: "DELETE"
    });

    setDeleting(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(payload?.error ?? "Failed to delete employee.");
      return;
    }

    toast.success("Employee deleted.");
    clearForm();
    router.refresh();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Left: Employee list */}
      <section className="space-y-4">
          <ManagerPaneHeader
            title="Employees"
            action={(
              <Button size="sm" onClick={clearForm}>
                + New Employee
              </Button>
            )}
          />

          <ManagerFilterBar>
            <Input
              className="lg:max-w-[22rem]"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, email, or ID"
            />
            <ManagerSelect value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}>
              <option value="all">All Roles</option>
              <option value="manager">Managers</option>
              <option value="cashier">Cashiers</option>
            </ManagerSelect>
          </ManagerFilterBar>

          <ManagerScrollArea className="space-y-3">
            {filteredEmployees.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-stone-500">
                No employees match the current filters.
              </p>
            ) : (
              filteredEmployees.map((emp) => (
                <Card
                  key={emp.employeeId}
                  className={`cursor-pointer transition hover:border-foreground/30 ${
                    selectedEmployee?.employeeId === emp.employeeId ? "border-foreground/50 bg-[rgb(var(--surface-alt))]" : ""
                  }`}
                  onClick={() => selectEmployee(emp)}
                >
                  <CardContent className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6 sm:py-5">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {emp.firstName} {emp.lastName}
                      </p>
                      <p className="text-sm text-stone-500">ID: {emp.employeeId}</p>
                      <p className="truncate text-sm text-stone-500">{emp.email ?? "No email linked yet"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {emp.isManager ? (
                        <Badge className="border-blue-300 text-blue-700">Manager</Badge>
                      ) : (
                        <Badge className="bg-white text-stone-700">Cashier</Badge>
                      )}
                      <Badge className="bg-white text-stone-700">
                        {emp.password == null ? "No PIN" : "PIN set"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </ManagerScrollArea>
      </section>

      {/* Right: Employee form */}
      <section>
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedEmployee ? `Edit Employee #${selectedEmployee.employeeId}` : "New Employee"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="Enter first name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="Enter last name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Google Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="employee@example.com"
                  />
                  <p className="text-sm text-stone-500">
                    Keep this email for employee records and customer account linking.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Employee PIN</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    inputMode="numeric"
                    maxLength={4}
                    onChange={(event) => setPassword(event.target.value.replace(/\D/g, ""))}
                    placeholder="Enter 4-digit PIN"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    id="isManager"
                    type="checkbox"
                    checked={isManager}
                    onChange={(event) => setIsManager(event.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <Label htmlFor="isManager">Manager</Label>
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={submitting} className="flex-1">
                    {submitting
                      ? "Saving..."
                      : selectedEmployee
                        ? "Save Changes"
                        : "Create Employee"}
                  </Button>
                  {selectedEmployee ? (
                    <Button type="button" variant="outline" onClick={clearForm}>
                      Cancel
                    </Button>
                  ) : null}
                  {selectedEmployee ? (
                    <Button type="button" variant="outline" onClick={() => void handleDelete()} disabled={deleting}>
                      {deleting ? "Deleting..." : "Delete"}
                    </Button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>
      </section>
    </div>
  );
}
