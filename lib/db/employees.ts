import { prisma } from "@/lib/prisma";
import type { EmployeeRecord } from "@/lib/types";

function mapEmployee(record: {
  employee_id: number;
  first_name: string;
  last_name: string;
  is_manager: boolean;
}): EmployeeRecord {
  return {
    employeeId: record.employee_id,
    firstName: record.first_name,
    lastName: record.last_name,
    isManager: record.is_manager
  };
}

export async function getEmployees() {
  const employees = await prisma.employee.findMany({
    orderBy: {
      last_name: "asc"
    }
  });

  return employees.map(mapEmployee);
}

export async function addEmployee(firstName: string, lastName: string, isManager: boolean) {
  await prisma.$executeRaw`
    INSERT INTO employee (first_name, last_name, is_manager)
    VALUES (${firstName}, ${lastName}, ${isManager})
  `;
}

export async function saveEmployee(
  employeeId: number,
  firstName: string,
  lastName: string,
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
}

