import { redirect } from "next/navigation";

import { requireEmployeePage } from "@/lib/auth";

export default async function ManagerPage() {
  const employee = await requireEmployeePage();

  if (!employee.isManager) {
    redirect("/pos");
  }

  redirect("/manager/inventory");
}
