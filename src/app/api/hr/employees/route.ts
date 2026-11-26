import { NextResponse } from 'next/server';
import { getEmployees, createEmployee, getUserGrantedRights } from '@/lib/erp-db';

async function assertEmployeeRight(request: Request, rightCode: 'emp.add' | 'emp.edit') {
  const role = request.headers.get('x-user-role') || 'User';
  if (role === 'Admin' || role === 'Superadmin') return;

  if (role !== 'User') {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }

  const userId = Number(request.headers.get('x-user-id'));
  if (!Number.isInteger(userId) || userId <= 0) {
    throw Object.assign(new Error('Unauthorized: user identity is required'), { status: 401 });
  }

  const rights = await getUserGrantedRights(userId);
  if (!rights.includes(rightCode) && !rights.includes('*')) {
    throw Object.assign(new Error(`Forbidden: missing required permission '${rightCode}'`), { status: 403 });
  }
}

function isValidDate(val: unknown): val is string {
  if (typeof val !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val.trim())) return false;
  const d = new Date(`${val.trim()}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(val.trim());
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const role = request.headers.get('x-user-role') || 'User';

    const result = await getEmployees({ search, status, role });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API GET /api/hr/employees] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve employees' },
      { status: err.status || 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await assertEmployeeRight(request, 'emp.add');

    const body = await request.json();
    const empNo = typeof body.empNo === 'string' ? body.empNo.trim() : '';
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
    const gender = typeof body.gender === 'string' ? body.gender.trim().toUpperCase() : '';
    const birthDate = typeof body.birthDate === 'string' ? body.birthDate.trim() : '';
    const hireDate = typeof body.hireDate === 'string' ? body.hireDate.trim() : '';
    const sepDate =
      body.sepDate === null || body.sepDate === undefined || String(body.sepDate).trim() === ''
        ? null
        : String(body.sepDate).trim();

    if (!empNo || empNo.length > 10 || !lastName || !firstName) {
      return NextResponse.json(
        { error: 'empNo (<=10 chars), lastName, and firstName are required' },
        { status: 400 }
      );
    }

    if (gender !== 'M' && gender !== 'F') {
      return NextResponse.json({ error: "Gender must be 'M' or 'F'" }, { status: 400 });
    }

    if (!isValidDate(birthDate) || !isValidDate(hireDate) || birthDate >= hireDate) {
      return NextResponse.json(
        { error: 'Valid birthDate and hireDate (YYYY-MM-DD) with birthDate < hireDate are required' },
        { status: 400 }
      );
    }

    if (sepDate !== null && (!isValidDate(sepDate) || sepDate < hireDate)) {
      return NextResponse.json(
        { error: 'sepDate must be a valid date >= hireDate' },
        { status: 400 }
      );
    }

    const actor = request.headers.get('x-user-email') || request.headers.get('x-user-role') || 'system';
    const employee = await createEmployee({
      empNo,
      lastName,
      firstName,
      gender,
      birthDate,
      hireDate,
      sepDate,
      actor,
    });

    return NextResponse.json(
      { message: 'Employee created successfully', employee, ...employee },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[API POST /api/hr/employees] error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create employee' },
      { status: err.status || 500 }
    );
  }
}
