"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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
  const [isManager, setIsManager] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function selectEmployee(employee: EmployeeRecord) {
    setSelectedEmployee(employee);
    setFirstName(employee.firstName);
    setLastName(employee.lastName);
    setEmail(employee.email ?? "");
    setIsManager(employee.isManager);
  }

  function clearForm() {
    setSelectedEmployee(null);
    setFirstName("");
    setLastName("");
    setEmail("");
    setIsManager(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedFirst || !trimmedLast || !trimmedEmail) {
      toast.error("First name, last name, and email are required.");
      return;
    }

    setSubmitting(true);

    const body = { firstName: trimmedFirst, lastName: trimmedLast, email: trimmedEmail, isManager };

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

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Left: Employee list */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Employees</h2>
          <Button size="sm" onClick={clearForm}>
            + New Employee
          </Button>
        </div>

        <div className="max-h-[600px] space-y-3 overflow-y-auto pr-1">
          {employees.map((emp) => (
            <Card
              key={emp.employeeId}
              className={`cursor-pointer transition hover:border-foreground/30 ${
                selectedEmployee?.employeeId === emp.employeeId ? "border-foreground/50 bg-[rgb(var(--surface-alt))]" : ""
              }`}
              onClick={() => selectEmployee(emp)}
            >
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-semibold">
                    {emp.firstName} {emp.lastName}
                  </p>
                  <p className="text-sm text-stone-500">ID: {emp.employeeId}</p>
                  <p className="text-sm text-stone-500">{emp.email ?? "No email linked yet"}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {emp.isManager ? (
                    <Badge className="border-blue-300 text-blue-700">Manager</Badge>
                  ) : (
                    <Badge className="bg-white text-stone-700">Cashier</Badge>
                  )}
                  <Badge className="bg-white text-stone-700">
                    {emp.hasGoogleAccount ? "OAuth linked" : "Awaiting first Google sign-in"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
                  This email controls Google OAuth access for the POS and manager views.
                </p>
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
              </div>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
