import { prisma } from "@/lib/db";
import { getActiveUserId } from "@/lib/active-user";
import { PageHeader } from "@/components/ui/page-header";
import { UploadForm } from "@/components/upload/upload-form";

export default async function UploadPage() {
  const userId = await getActiveUserId();
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <PageHeader
        title="Upload Statement"
        subtitle="Upload a CSV or PDF bank statement to import transactions"
      />
      <UploadForm categories={categories} userId={userId || undefined} />
    </>
  );
}
