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
  password: number | null;
}): EmployeeRecord {
  return {
    employeeId: record.employee_id,
    firstName: record.first_name,
    lastName: record.last_name,
    email: record.email,
    isManager: record.is_manager,
    hasGoogleAccount: record.has_google_account,
    password: record.password
  };
}

export async function getEmployeeByPasscode(password: number) {
  // Use Prisma to find a unique employee where the password matches.
  const employee = await prisma.employee.findFirst({
    where: {
      password: password,
    },
  });

  // If no employee is found with that PIN, return null.
  if (!employee) {
    return null;
  }

  // If an employee is found, we need to enrich their record with Google Auth info,
  // just like the getEmployees() function does, so the return type is consistent.
  const authMap = await getEmployeeGoogleAuthMap();
  const authInfo = authMap.get(employee.employee_id);

  // Use your existing `mapEmployee` helper to format the final record.
  return mapEmployee({
    ...employee,
    email: authInfo?.email ?? null,
    has_google_account: !!authInfo?.googleId,
  });
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

export async function addEmployee(firstName: string, lastName: string, email: string, isManager: boolean, password: number) {
  const nextIdRows = await prisma.$queryRaw<Array<{ next_id: number }>>`
    SELECT COALESCE(MAX(employee_id), 0) + 1 AS next_id
    FROM employee
  `;

  const employeeId = nextIdRows[0]?.next_id;

  if (typeof employeeId !== "number") {
    throw new Error("Failed to create employee.");
  }

  await prisma.$executeRaw`
    INSERT INTO employee (employee_id, first_name, last_name, is_manager)
    VALUES (${employeeId}, ${firstName}, ${lastName}, ${isManager})
  `;

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
  isManager: boolean,
  passWord: number
) {
  await prisma.employee.update({
    where: {
      employee_id: employeeId
    },
    data: {
      first_name: firstName,
      last_name: lastName,
      is_manager: isManager,
      password: passWord
    }
  });

  await saveEmployeeGoogleAuthLink({
    employeeId,
    email,
    firstName,
    lastName
  });
}

export async function deleteEmployee(employeeId: number) {
  await prisma.$executeRaw`
    UPDATE auth_user
    SET employee_id = NULL,
        updated_at = NOW()
    WHERE employee_id = ${employeeId}
  `;

  await prisma.employee.delete({
    where: {
      employee_id: employeeId
    }
  });
}

