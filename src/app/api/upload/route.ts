import { NextResponse } from "next/server";
import { parseCSVWithMetadata } from "@/lib/parsers/csv-parser";
import { parsePDFWithMetadata } from "@/lib/parsers/pdf-parser";
import { isInvestmentCSV, parseInvestmentCSVWithMetadata } from "@/lib/parsers/investment-csv-parser";
import { isInvestmentPDF, parseInvestmentPDFWithMetadata } from "@/lib/parsers/investment-pdf-parser";
import { categorizeTransactions } from "@/lib/categorizer";
import {
  requireAuth,
  checkRateLimit,
  validateFileUpload,
  safeError,
  auditLog,
} from "@/lib/security";
import { withLogging } from "@/lib/api-logger";

export const POST = withLogging(async function POST(request: Request) {
  const rateLimited = checkRateLimit(request, "file-upload", 200, 60 * 1000);
  if (rateLimited) return rateLimited;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return safeError("File is required.");
  }

  const fileError = validateFileUpload(file);
  if (fileError) {
    return safeError(fileError);
  }

  const filename = file.name.toLowerCase();

  auditLog("file.upload", auth.user.id, {
    filename: file.name,
    size: file.size,
  });

  if (filename.endsWith(".csv")) {
    const text = await file.text();

    // Check if this is an investment CSV first
    if (isInvestmentCSV(text)) {
      const investmentResult = parseInvestmentCSVWithMetadata(text, file.name);
      if (investmentResult.transactions.length === 0 && (!investmentResult.failedRows || investmentResult.failedRows.length === 0)) {
        return safeError("No investment transactions found in the file.");
      }
      return NextResponse.json({
        isInvestment: true,
        investmentTransactions: investmentResult.transactions,
        failedRows: investmentResult.failedRows ?? [],
        filename: file.name,
        bankName: investmentResult.bankName,
        accountLabel: investmentResult.accountLabel,
        accountType: investmentResult.accountType,
      });
    }

    // Regular bank CSV
    const parsed = parseCSVWithMetadata(text, file.name);
    if (parsed.transactions.length === 0 && (!parsed.failedRows || parsed.failedRows.length === 0)) {
      return safeError("No transactions found in the file.");
    }
    const categorized = parsed.transactions.length > 0
      ? await categorizeTransactions(parsed.transactions)
      : [];
    return NextResponse.json({
      isInvestment: false,
      transactions: categorized,
      failedRows: parsed.failedRows ?? [],
      filename: file.name,
      bankName: parsed.bankName,
      accountLabel: parsed.accountLabel,
    });
  } else if (filename.endsWith(".pdf")) {
    const buffer = Buffer.from(await file.arrayBuffer());

    // Check if this is an investment PDF first
    if (await isInvestmentPDF(buffer)) {
      const investmentResult = await parseInvestmentPDFWithMetadata(buffer, file.name);
      if (investmentResult.transactions.length === 0 && (!investmentResult.failedRows || investmentResult.failedRows.length === 0)) {
        return safeError("No investment transactions found in the file.");
      }
      return NextResponse.json({
        isInvestment: true,
        investmentTransactions: investmentResult.transactions,
        failedRows: investmentResult.failedRows ?? [],
        filename: file.name,
        bankName: investmentResult.bankName,
        accountLabel: investmentResult.accountLabel,
        accountType: investmentResult.accountType,
      });
    }

    // Regular bank PDF
    const parsed = await parsePDFWithMetadata(buffer, file.name);
    if (parsed.transactions.length === 0 && (!parsed.failedRows || parsed.failedRows.length === 0)) {
      return safeError("No transactions found in the file.");
    }
    const categorized = parsed.transactions.length > 0
      ? await categorizeTransactions(parsed.transactions)
      : [];
    return NextResponse.json({
      isInvestment: false,
      transactions: categorized,
      failedRows: parsed.failedRows ?? [],
      filename: file.name,
      bankName: parsed.bankName,
      accountLabel: parsed.accountLabel,
    });
  } else {
    return safeError("Only CSV and PDF files are supported.");
  }
});
