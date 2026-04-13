import { prisma } from "@/lib/prisma";
import { getEmployeeGoogleAuthMap, saveEmployeeGoogleAuthLink } from "@/lib/db/google-auth";
import type { EmployeeRecord } from "@/lib/types";

function mapEmployee(record: {
  employee_id: number;
  first_name: string;
  last_name: string;
  is_manager: boolean;
  email: string | null;
  has_google_account: boolean;
}): EmployeeRecord {
  return {
    employeeId: record.employee_id,
    firstName: record.first_name,
    lastName: record.last_name,
    email: record.email,
    isManager: record.is_manager,
    hasGoogleAccount: record.has_google_account
  };
}

export async function getEmployees() {
  const employees = await prisma.employee.findMany({
    orderBy: {
      last_name: "asc"
    }
  });

  const authMap = await getEmployeeGoogleAuthMap();

  return employees.map((record) =>
    mapEmployee({
      ...record,
      email: authMap.get(record.employee_id)?.email ?? null,
      has_google_account: !!authMap.get(record.employee_id)?.googleId
    })
  );
}

export async function addEmployee(firstName: string, lastName: string, email: string, isManager: boolean) {
  const rows = await prisma.$queryRaw<Array<{ employee_id: number }>>`
    INSERT INTO employee (first_name, last_name, is_manager)
    VALUES (${firstName}, ${lastName}, ${isManager})
    RETURNING employee_id
  `;

  const employeeId = rows[0]?.employee_id;

  if (!employeeId) {
    throw new Error("Failed to create employee.");
  }

  await saveEmployeeGoogleAuthLink({
    employeeId,
    email,
    firstName,
    lastName
  });
}

export async function saveEmployee(
  employeeId: number,
  firstName: string,
  lastName: string,
  email: string,
  isManager: boolean
) {
  await prisma.employee.update({
    where: {
      employee_id: employeeId
    },
    data: {
      first_name: firstName,
      last_name: lastName,
      is_manager: isManager
    }
  });

  await saveEmployeeGoogleAuthLink({
    employeeId,
    email,
    firstName,
    lastName
  });
}

