import { NextResponse } from "next/server";

export async function POST(request: Request) {
  void request;
  return NextResponse.json(
    { error: "Employee ID/password login has been replaced by Google sign-in." },
    { status: 410 }
  );
}
