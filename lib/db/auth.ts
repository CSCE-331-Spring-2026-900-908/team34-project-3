import type { employee } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { SessionEmployee } from "@/lib/types";

function toSessionEmployee(record: employee): SessionEmployee {
  return {
    employeeId: record.employee_id,
    firstName: record.first_name,
    lastName: record.last_name,
    fullName: `${record.first_name} ${record.last_name}`,
    isManager: record.is_manager
  };
}

export async function validateEmployeeLogin(employeeId: number, password: string) {
  const record = await prisma.employee.findUnique({
    where: {
      employee_id: employeeId
    }
  });

  if (!record) {
    return null;
  }

  if (String(record.password ?? "") !== password) {
    return null;
  }

  return toSessionEmployee(record);
}
