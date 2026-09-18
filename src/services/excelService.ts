import ExcelJS from 'exceljs';
import { TaskInput, ProcessedTaskResult, ContentType, ColumnMapping } from '../types';

export interface ExcelParseResult {
  tasks: TaskInput[];
  headers: string[];               // Raw header names from row 1
  autoMapping: ColumnMapping;       // Auto-detected column indices
  sampleRows: Record<string, any>[]; // First 5 rows for preview
}

export class ExcelService {
  /**
   * Helper to safely extract string/URL values from ExcelJS Cells.
   * Handles string/number primitive values, cell hyperlinks ({ text, hyperlink }),
   * formula results ({ formula, result }), and rich text arrays.
   */
  public static extractCellValue(cell: ExcelJS.Cell): string {
    const val = cell.value;
    if (val === null || val === undefined) return '';
    return this.extractStringFromAny(val);
  }

  private static extractStringFromAny(val: any): string {
    if (val === null || val === undefined) return '';

    if (typeof val === 'object') {
      // 1. ExcelJS Hyperlink object: { text: "...", hyperlink: "..." }
      if (val.hyperlink) {
        return String(val.hyperlink).trim() || String(val.text || '').trim();
      }
      // 2. ExcelJS Formula object: { formula: "...", result: "..." }
      if (val.result !== undefined && val.result !== null) {
        return this.extractStringFromAny(val.result);
      }
      // 3. Object with text property
      if (val.text !== undefined && val.text !== null) {
        if (typeof val.text === 'string') return val.text.trim();
        return this.extractStringFromAny(val.text);
      }
      // 4. ExcelJS Rich Text array: { richText: [{ text: "..." }] }
      if (Array.isArray(val.richText)) {
        return val.richText.map((item: any) => item.text || '').join('').trim();
      }
      // 5. Date object
      if (val instanceof Date) {
        return val.toISOString().split('T')[0];
      }
    }

    return String(val).trim();
  }

  /**
   * Reads an Excel file and returns raw headers + auto-detected mapping.
   * Actual task parsing uses the mapping (auto or manual override).
   */
  public static async parseExcel(filePath: string, manualMapping?: ColumnMapping): Promise<ExcelParseResult> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('Excel file does not contain any worksheet.');
    }

    // 1. Extract raw headers
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      // Ensure array is filled up to this column
      while (headers.length < colNumber) {
        headers.push(`Column ${headers.length + 1}`);
      }
      headers[colNumber - 1] = this.extractCellValue(cell) || `Column ${colNumber}`;
    });

    // 2. Smart auto-detection
    const autoMapping = this.autoDetectColumns(headers);

    // Use manual mapping if provided, otherwise use auto
    const mapping = manualMapping || autoMapping;

    // 3. Parse all data rows using the active mapping
    const tasks = this.parseRowsWithMapping(worksheet, headerRow, headers, mapping);

    // 4. Sample rows for preview (first 5)
    const sampleRows: Record<string, any>[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1 || sampleRows.length >= 5) return;
      const rowData: Record<string, any> = {};
      headers.forEach((h, i) => {
        rowData[h] = this.extractCellValue(row.getCell(i + 1));
      });
      sampleRows.push(rowData);
    });

    return { tasks, headers, autoMapping, sampleRows };
  }

  /**
   * Smart auto-detection of column indices based on header text patterns.
   * Returns 0-based indices mapped to 1-based ExcelJS column numbers.
   */
  private static autoDetectColumns(headers: string[]): ColumnMapping {
    let keyword = -1;
    let contentType = -1;
    let targetSite = -1;
    let keywordWebsite = -1;
    let date = -1;
    let finalLink = -1;

    headers.forEach((h, i) => {
      const colNum = i + 1; // ExcelJS uses 1-based
      const lower = h.toLowerCase().trim();

      // Keyword column
      if (keyword === -1 && (lower === 'keyword' || lower === 'keywords' || lower.includes('keyword'))) {
        keyword = colNum;
      }

      // Content Type / Submission type column
      // Match "submission" alone (not "submission link" or "submission url")
      if (contentType === -1) {
        if (lower === 'submission' || lower === 'content type' || lower === 'type of content' ||
            lower === 'type' || lower === 'contenttype') {
          contentType = colNum;
        }
      }

      // Target Site / Submission Link column (the URL where content is submitted)
      if (targetSite === -1) {
        if (lower === 'submission link' || lower === 'submission url' ||
            lower === 'submission site' || lower === 'target site' ||
            lower === 'site' || lower.includes('submission link') ||
            lower.includes('submission url') || lower.includes('target site') ||
            lower === 'site on which content is to be submitted') {
          targetSite = colNum;
        }
      }

      // Keyword Website column (URL to hyperlink the keyword to)
      if (keywordWebsite === -1) {
        if (lower === 'website' || lower === 'keyword website' || lower === 'keyword url' ||
            lower === 'client website' || lower === 'keyword link' || lower === 'website url') {
          keywordWebsite = colNum;
        }
      }

      // Date column
      if (date === -1 && (lower === 'date' || lower.includes('date'))) {
        date = colNum;
      }

      // Final Link column (output)
      if (finalLink === -1) {
        if (lower === 'final link' || lower === 'final url' || lower === 'published url' ||
            lower === 'result link' || lower.includes('final link')) {
          finalLink = colNum;
        }
      }
    });

    // Fallbacks: if we couldn't detect, assign defaults
    if (keyword === -1) keyword = 1;
    if (contentType === -1) contentType = headers.length >= 3 ? 3 : 2;
    if (targetSite === -1) targetSite = headers.length >= 4 ? 4 : 3;
    if (keywordWebsite === -1) keywordWebsite = 0; // 0 = not found / not mapped

    return {
      keyword,
      contentType,
      targetSite,
      keywordWebsite,
      date: date !== -1 ? date : undefined,
      finalLink: finalLink !== -1 ? finalLink : undefined,
    };
  }

  /**
   * Parse worksheet rows using a given column mapping.
   */
  private static parseRowsWithMapping(
    worksheet: ExcelJS.Worksheet,
    headerRow: ExcelJS.Row,
    headers: string[],
    mapping: ColumnMapping
  ): TaskInput[] {
    const tasks: TaskInput[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header row

      const keyword = this.extractCellValue(row.getCell(mapping.keyword));
      const contentTypeRaw = this.extractCellValue(row.getCell(mapping.contentType));
      const targetSite = this.extractCellValue(row.getCell(mapping.targetSite));
      const keywordWebsite = mapping.keywordWebsite > 0
        ? this.extractCellValue(row.getCell(mapping.keywordWebsite))
        : '';

      if (!keyword && !targetSite) {
        return; // Skip empty rows
      }

      // Standardize content type
      let contentType: ContentType = 'Bookmarking'; // Default to Bookmarking
      const typeLower = contentTypeRaw.toLowerCase();
      if (typeLower.includes('bookmark')) contentType = 'Bookmarking';
      else if (typeLower.includes('classif')) contentType = 'Classifieds';
      else if (typeLower.includes('blog')) contentType = 'Blogs';
      else if (typeLower.includes('article')) contentType = 'Articles';

      // Capture raw row data
      const rawRow: Record<string, any> = {};
      headers.forEach((h, i) => {
        rawRow[h] = this.extractCellValue(row.getCell(i + 1));
      });

      tasks.push({
        rowIndex: rowNumber,
        keyword,
        contentType,
        targetSite,
        keywordWebsite: keywordWebsite || undefined,
        rawRow,
      });
    });

    return tasks;
  }

  /**
   * Legacy method — reads tasks with auto-detection only.
   */
  public static async readTasks(filePath: string): Promise<TaskInput[]> {
    const result = await this.parseExcel(filePath);
    return result.tasks;
  }

  /**
   * Writes results back into a clean, formatted Excel file preserving original data.
   */
  public static async writeResults(outputPath: string, results: ProcessedTaskResult[]): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('SEO Submissions');

    // Define columns
    worksheet.columns = [
      { header: 'Row #', key: 'rowIndex', width: 8 },
      { header: 'Keyword', key: 'keyword', width: 30 },
      { header: 'Type of Content', key: 'contentType', width: 18 },
      { header: 'Target Site', key: 'targetSite', width: 35 },
      { header: 'Keyword Website', key: 'keywordWebsite', width: 35 },
      { header: 'Generated Title', key: 'generatedTitle', width: 35 },
      { header: 'Generated Content', key: 'generatedContent', width: 50 },
      { header: 'Short Description', key: 'shortDescription', width: 35 },
      { header: 'AI Provider', key: 'aiProvider', width: 15 },
      { header: 'Submission Status', key: 'submissionStatus', width: 22 },
      { header: 'Submission URL', key: 'submissionUrl', width: 35 },
      { header: 'Final Published URL', key: 'finalPublishedUrl', width: 40 },
      { header: 'Verification Status', key: 'verificationStatus', width: 22 },
      { header: 'Error / Reason', key: 'error', width: 35 },
      { header: 'Submitted At', key: 'submittedAt', width: 22 },
    ];

    // Format Header Row
    const hdrRow = worksheet.getRow(1);
    hdrRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    hdrRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1E293B' }, // Dark slate
    };
    hdrRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Populate rows
    results.forEach((res) => {
      const row = worksheet.addRow({
        rowIndex: res.task.rowIndex,
        keyword: res.task.keyword,
        contentType: res.task.contentType,
        targetSite: res.task.targetSite,
        keywordWebsite: res.task.keywordWebsite || '',
        generatedTitle: res.generation?.aiResponse.title || '',
        generatedContent: res.generation?.aiResponse.content || '',
        shortDescription: res.generation?.aiResponse.short_description || '',
        aiProvider: res.generation?.providerUsed || 'N/A',
        submissionStatus: res.status,
        submissionUrl: res.submission?.submissionUrl || '',
        finalPublishedUrl: res.submission?.finalPublishedUrl || '',
        verificationStatus: res.verification?.verified ? 'VERIFIED_PUBLISHED' : (res.verification?.message || res.status),
        error: res.error || res.submission?.error || '',
        submittedAt: res.submission?.submittedAt || new Date().toISOString(),
      });

      // Status color coding
      const statusCell = row.getCell('submissionStatus');
      if (res.status === 'PUBLISHED') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCFCE7' } };
        statusCell.font = { color: { argb: '15803D' }, bold: true };
      } else if (res.status === 'REQUIRES_MANUAL_ACTION') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
        statusCell.font = { color: { argb: 'B45309' }, bold: true };
      } else if (res.status === 'PENDING_MODERATION') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E0F2FE' } };
        statusCell.font = { color: { argb: '0369A1' }, bold: true };
      } else if (res.status === 'FAILED' || res.status === 'VERIFICATION_FAILED') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
        statusCell.font = { color: { argb: 'B91C1C' }, bold: true };
      }
    });

    await workbook.xlsx.writeFile(outputPath);
  }
}
