import { pool } from "./db";

// ─── Super-admin promotion ────────────────────────────────────────────────────
// Heath Blake is the platform super admin. The eligibility rule is applied both
// at startup migration time AND at every session load (GET /api/users/me), so a
// fresh sign-in gets the super_admin role immediately — no server restart needed.

export const SUPER_ADMIN_CLERK_ID = "user_3C3xqd3DTyDMeiUdkAqCzT7dg1a";

const ELIGIBILITY_SQL = `(
  LOWER(COALESCE(name,  '')) LIKE '%heath%'
  OR LOWER(COALESCE(email, '')) LIKE '%heath%'
  OR clerk_user_id = '${SUPER_ADMIN_CLERK_ID}'
)`;

/** Promotes every eligible row to super_admin. Idempotent — used at startup. */
export async function promoteEligibleSuperAdmins(): Promise<void> {
  await pool.query(`
    UPDATE deal_users
    SET role = 'super_admin', updated_at = NOW()
    WHERE ${ELIGIBILITY_SQL}
    AND role != 'super_admin';
  `);
}

/** Promotes a single user at session load if eligible.
 *  Returns the updated row, or null if no promotion happened. */
export async function promoteSuperAdminIfEligible(
  dealUserId: number | string,
): Promise<Record<string, unknown> | null> {
  const result = await pool.query(
    `UPDATE deal_users
     SET role = 'super_admin', updated_at = NOW()
     WHERE id = $1
       AND role != 'super_admin'
       AND ${ELIGIBILITY_SQL}
     RETURNING *`,
    [dealUserId],
  );
  return (result.rows[0] as Record<string, unknown> | undefined) ?? null;
}
