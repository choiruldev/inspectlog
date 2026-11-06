import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  return handleBugRequest(req, null);
}

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  return handleBugRequest(req, body);
}

async function handleBugRequest(req: NextRequest, body: any) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "500";

  switch (type) {
    case "500":
      return NextResponse.json(
        {
          success: false,
          error: "Internal Server Error: Database pool connection timeout",
          code: "DB_CONNECTION_TIMEOUT",
          details: {
            table: "orders",
            attempt: 3,
            timestamp: new Date().toISOString(),
          },
          stack: "Error: DB pool connection exhausted\n    at acquirePoolConnection (/app/lib/db.ts:145:12)\n    at QueryExecutor.run (/app/lib/query.ts:32:8)",
        },
        { status: 500 }
      );

    case "422":
      return NextResponse.json(
        {
          success: false,
          error: "Unprocessable Entity: Schema validation failed",
          code: "PAYLOAD_VALIDATION_ERROR",
          receivedPayload: body,
          validationErrors: [
            { field: "email", error: "String must be a valid email format" },
            { field: "quantity", error: "Quantity is required and must be an integer >= 1" },
            { field: "price", error: "Price cannot be negative" },
          ],
        },
        { status: 422 }
      );

    case "401":
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Missing, invalid, or expired authentication token",
          code: "AUTH_TOKEN_EXPIRED",
          hint: "Pastikan menyertakan header 'Authorization: Bearer <valid_jwt>' pada request.",
        },
        { status: 401 }
      );

    case "403":
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden: Account role 'viewer' does not have permission 'system:manage_settings'",
          code: "INSUFFICIENT_PERMISSIONS",
          requiredRole: "admin",
        },
        { status: 403 }
      );

    case "404":
      return NextResponse.json(
        {
          success: false,
          error: "Resource Not Found: Endpoint '/api/v2/analytics/reports' does not exist",
          code: "ENDPOINT_NOT_FOUND",
        },
        { status: 404 }
      );

    case "slow": {
      // Simulate slow response (3.5 seconds)
      await new Promise((resolve) => setTimeout(resolve, 3500));
      return NextResponse.json({
        success: true,
        message: "Slow endpoint completed successfully after 3500ms delay",
        warning: "Latency is unusually high for an API response",
      });
    }

    default:
      return NextResponse.json({
        success: true,
        message: `Bug test API ready. Try ?type=500, 422, 401, 403, 404, or slow.`,
      });
  }
}
