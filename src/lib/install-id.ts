import { prisma } from "./db";
import { randomUUID } from "crypto";

const INSTALL_ID_KEY = "install_id";

/**
 * Get or create a unique install ID for this WalletLens instance.
 * Generated once on first access and persisted in the database.
 */
export async function getInstallId(): Promise<string> {
  const existing = await prisma.appConfig.findUnique({
    where: { key: INSTALL_ID_KEY },
  });

  if (existing) {
    return existing.value;
  }

  // Generate a short, readable install ID: "WL-" + first 8 chars of UUID
  const installId = `WL-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

  await prisma.appConfig.upsert({
    where: { key: INSTALL_ID_KEY },
    update: {},
    create: { key: INSTALL_ID_KEY, value: installId },
  });

  return installId;
}
