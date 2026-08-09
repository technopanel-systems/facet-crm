/**
 * Password hashing, in one place so the algorithm is swappable.
 *
 * bcryptjs: pure JS, no native build on the Windows host or in the Docker
 * image. At this user count its speed disadvantage over native bcrypt is
 * irrelevant; cost 12 keeps verification comfortably under interactive
 * latency while staying expensive to brute-force.
 */

import bcrypt from "bcryptjs";

const COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
