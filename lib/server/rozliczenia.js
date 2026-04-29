import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { REKLAMACJA_STATUS, ROLE } from "@/lib/constants";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { removePolishCharacters } from "@/lib/utils";

const PDF_FONT_PATH = path.join(
  process.cwd(),
  "public",
  "fonts",
  "NotoSans-Regular.ttf"
);
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WARSAW_DAY_KEY_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const PDF_DATE_FORMATTER = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const PDF_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const SETTLEMENT_COMPLETED_STATUSES = [
  REKLAMACJA_STATUS.DONE,
  REKLAMACJA_STATUS.ARCHIVE,
];

function createHttpError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function ensureAdminActor(actor) {
  if (actor?.role !== ROLE.ADMIN) {
    throw createHttpError("Brak uprawnien.", 403);
  }
}

function normalizeDateInput(value, label) {
  const normalized = `${value || ""}`.trim();

  if (!normalized) {
    return "";
  }

  if (!DATE_INPUT_PATTERN.test(normalized)) {
    throw createHttpError(`${label} ma nieprawidlowy format daty.`, 422);
  }

  const parsed = new Date(`${normalized}T12:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw createHttpError(`${label} ma nieprawidlowa wartosc.`, 422);
  }

  return normalized;
}

function validateDateRange({ dateFrom, dateTo, optional = false } = {}) {
  const normalizedFrom = normalizeDateInput(dateFrom, "Data od");
  const normalizedTo = normalizeDateInput(dateTo, "Data do");

  if (!normalizedFrom && !normalizedTo && optional) {
    return {
      dateFrom: "",
      dateTo: "",
    };
  }

  if (!normalizedFrom || !normalizedTo) {
    throw createHttpError("Wybierz pelny zakres dat.", 422);
  }

  if (normalizedFrom > normalizedTo) {
    throw createHttpError("Data od nie moze byc pozniejsza niz data do.", 422);
  }

  return {
    dateFrom: normalizedFrom,
    dateTo: normalizedTo,
  };
}

function toWarsawDayKey(value) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return WARSAW_DAY_KEY_FORMATTER.format(parsed);
}

function formatDateForPdf(value) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return PDF_DATE_FORMATTER.format(parsed);
}

function formatTimestampForPdf(value) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return PDF_TIMESTAMP_FORMATTER.format(parsed);
}

function getComplaintDocumentNumber(complaint) {
  return (
    `${complaint?.numer_faktury || ""}`.trim() ||
    `${complaint?.nr_reklamacji || ""}`.trim() ||
    "-"
  );
}

function buildSettlementFileName(companyName, dateFrom, dateTo) {
  const companySlug =
    removePolishCharacters(companyName || "firma")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "firma";

  return `rozliczenie-${companySlug}-${dateFrom}-${dateTo}.pdf`;
}

async function loadCompanyOptions() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("firmy")
    .select("firma_id,nazwa_firmy,email,rola")
    .order("nazwa_firmy", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || [])
    .filter((item) => item?.firma_id && item.rola !== ROLE.ADMIN)
    .map((item) => ({
      firma_id: item.firma_id,
      nazwa_firmy: item.nazwa_firmy || item.email || "Bez nazwy firmy",
      email: item.email || "",
    }));
}

async function loadFinishedComplaintsForCompany(firmaId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("reklamacje")
    .select(
      "id,firma_id,nazwa_firmy,realizacja_do,data_zakonczenia,numer_faktury,nr_reklamacji,nazwa_mebla,status"
    )
    .eq("firma_id", firmaId)
    .in("status", SETTLEMENT_COMPLETED_STATUSES)
    .order("data_zakonczenia", { ascending: true })
    .order("realizacja_do", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

function filterComplaintsByCompletionPeriod(complaints, dateFrom, dateTo) {
  return complaints.filter((complaint) => {
    const completionDayKey = toWarsawDayKey(complaint.data_zakonczenia);

    return Boolean(
      completionDayKey &&
        completionDayKey >= dateFrom &&
        completionDayKey <= dateTo
    );
  });
}

function ensurePdfFont() {
  if (!fs.existsSync(PDF_FONT_PATH)) {
    throw createHttpError("Brak fontu do generowania PDF.", 500);
  }

  return PDF_FONT_PATH;
}

function drawTableHeader(doc, columns, y) {
  doc.save();
  doc.fontSize(10).fillColor("#0f172a");

  columns.forEach((column) => {
    doc
      .rect(column.x, y, column.width, 24)
      .fillAndStroke("#e2e8f0", "#cbd5e1");
    doc
      .fillColor("#0f172a")
      .text(column.label, column.x + 6, y + 7, {
        width: column.width - 12,
        align: column.align || "left",
      });
  });

  doc.restore();
  return y + 24;
}

function drawTableRow(doc, columns, row, y) {
  const cellPadding = 6;
  const textOptions = columns.map((column) => ({
    width: column.width - cellPadding * 2,
    align: column.align || "left",
  }));
  const rowHeight =
    Math.max(
      ...columns.map((column, index) =>
        doc.heightOfString(row[column.key] || "", textOptions[index])
      ),
      16
    ) +
    cellPadding * 2;

  columns.forEach((column, index) => {
    doc.rect(column.x, y, column.width, rowHeight).stroke("#cbd5e1");
    doc.text(row[column.key] || "", column.x + cellPadding, y + cellPadding, {
      ...textOptions[index],
    });
  });

  return y + rowHeight;
}

function drawContinuationHeader(doc, companyName, dateFrom, dateTo) {
  doc.fontSize(14).fillColor("#0f172a").text("Rozliczenie okresowe");
  doc
    .fontSize(9)
    .fillColor("#475569")
    .text(`${companyName} | okres zakonczenia: ${dateFrom} - ${dateTo}`);
  return doc.y + 12;
}

async function buildSettlementPdfBuffer({
  companyName,
  dateFrom,
  dateTo,
  complaints,
}) {
  const fontPath = ensurePdfFont();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      bufferPages: true,
      info: {
        Title: `Rozliczenie okresowe - ${companyName}`,
        Author: "Meblofix",
      },
    });
    const chunks = [];
    const columns = [
      { key: "lp", label: "Lp", x: 40, width: 32, align: "center" },
      { key: "termin", label: "Data zakonczenia", x: 72, width: 90 },
      {
        key: "numer",
        label: "Numer faktury / reklamacji",
        x: 162,
        width: 170,
      },
      { key: "mebel", label: "Nazwa mebla", x: 332, width: 223 },
    ];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font(fontPath);
    doc.fontSize(18).fillColor("#0f172a").text("Rozliczenie okresowe");
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor("#334155");
    doc.text(`Firma: ${companyName}`);
    doc.text(`Okres zakonczenia: ${dateFrom} - ${dateTo}`);
    doc.text(`Liczba reklamacji: ${complaints.length}`);
    doc.text(`Wygenerowano: ${formatTimestampForPdf(new Date().toISOString())}`);

    let y = doc.y + 14;
    doc.fontSize(10).fillColor("#0f172a");
    y = drawTableHeader(doc, columns, y);

    complaints.forEach((complaint, index) => {
      const row = {
        lp: String(index + 1),
        termin: formatDateForPdf(complaint.data_zakonczenia),
        numer: getComplaintDocumentNumber(complaint),
        mebel: complaint.nazwa_mebla || "-",
      };

      const estimatedRowHeight =
        Math.max(
          doc.heightOfString(row.numer, { width: 158 }),
          doc.heightOfString(row.mebel, { width: 211 }),
          doc.heightOfString(row.termin, { width: 78 }),
          16
        ) + 12;

      if (
        y + estimatedRowHeight >
        doc.page.height - doc.page.margins.bottom - 30
      ) {
        doc.addPage();
        doc.font(fontPath);
        y = drawContinuationHeader(doc, companyName, dateFrom, dateTo);
        y = drawTableHeader(doc, columns, y);
      }

      y = drawTableRow(doc, columns, row, y);
    });

    const range = doc.bufferedPageRange();

    for (let pageIndex = 0; pageIndex < range.count; pageIndex += 1) {
      doc.switchToPage(pageIndex);
      doc.font(fontPath).fontSize(9).fillColor("#64748b");
      doc.text(
        `Strona ${pageIndex + 1} z ${range.count}`,
        40,
        doc.page.height - 30,
        {
          width: doc.page.width - 80,
          align: "right",
        }
      );
    }

    doc.end();
  });
}

export async function listSettlementCompanies({ actor }) {
  ensureAdminActor(actor);
  return loadCompanyOptions();
}

export async function listSettlementComplaints({
  actor,
  firmaId,
  dateFrom,
  dateTo,
}) {
  ensureAdminActor(actor);

  if (!firmaId) {
    return [];
  }

  const range = validateDateRange({
    dateFrom,
    dateTo,
    optional: true,
  });

  if (!range.dateFrom || !range.dateTo) {
    return [];
  }

  const complaints = await loadFinishedComplaintsForCompany(firmaId);

  return filterComplaintsByCompletionPeriod(
    complaints,
    range.dateFrom,
    range.dateTo
  );
}

export async function generateSettlementPdf({
  actor,
  firmaId,
  dateFrom,
  dateTo,
  reklamacjeIds = [],
}) {
  ensureAdminActor(actor);

  if (!firmaId) {
    throw createHttpError("Wybierz firme do rozliczenia.", 422);
  }

  const range = validateDateRange({ dateFrom, dateTo });

  if (!Array.isArray(reklamacjeIds) || !reklamacjeIds.length) {
    throw createHttpError("Wybierz przynajmniej jedna reklamacje.", 422);
  }

  const companies = await loadCompanyOptions();
  const company = companies.find((item) => item.firma_id === firmaId);

  if (!company) {
    throw createHttpError("Nie znaleziono wybranej firmy.", 404);
  }

  const complaints = await listSettlementComplaints({
    actor,
    firmaId,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
  });
  const selectedComplaintIds = new Set(
    reklamacjeIds.map((item) => `${item || ""}`.trim()).filter(Boolean)
  );
  const selectedComplaints = complaints.filter((complaint) =>
    selectedComplaintIds.has(complaint.id)
  );

  if (!selectedComplaints.length) {
    throw createHttpError(
      "Brak zakonczonych reklamacji dla wybranego zestawienia.",
      422
    );
  }

  if (selectedComplaints.length !== selectedComplaintIds.size) {
    throw createHttpError(
      "Czesc wybranych reklamacji nie nalezy do wskazanej firmy lub okresu.",
      422
    );
  }

  const buffer = await buildSettlementPdfBuffer({
    companyName: company.nazwa_firmy,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    complaints: selectedComplaints,
  });

  return {
    buffer,
    fileName: buildSettlementFileName(
      company.nazwa_firmy,
      range.dateFrom,
      range.dateTo
    ),
    count: selectedComplaints.length,
  };
}
