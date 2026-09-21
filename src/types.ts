export type ContentType = 'Bookmarking' | 'Classifieds' | 'Blogs' | 'Articles';

export type TaskStatus = 
  | 'PENDING'
  | 'ANALYZING'
  | 'GENERATED'
  | 'SUBMITTED'
  | 'PUBLISHED'
  | 'PENDING_MODERATION'
  | 'REQUIRES_MANUAL_ACTION'
  | 'VERIFICATION_FAILED'
  | 'FAILED';

/** Manual or auto-detected column mapping from Excel headers */
export interface ColumnMapping {
  keyword: number;        // Column index for Keyword
  contentType: number;    // Column index for Content Type / Submission
  targetSite: number;     // Column index for Submission Link / Target URL
  keywordWebsite: number; // Column index for Website (URL to hyperlink keyword to)
  title?: number;         // Column index for pre-existing Title (optional)
  description?: number;   // Column index for pre-existing Description / Summary (optional)
  date?: number;          // Column index for Date (optional)
  finalLink?: number;     // Column index for Final Link (optional, output)
}

export interface TaskInput {
  rowIndex: number;
  keyword: string;
  contentType: ContentType;
  targetSite: string;
  keywordWebsite?: string; // URL to hyperlink the keyword to in generated content
  rawRow: Record<string, any>;
}

export interface AIContentResponse {
  title: string;
  content: string; // Detailed body content (may contain HTML hyperlinks)
  short_description: string;
  category: string;
  tags: string[];
  target_url: string; // Anchor link / target site
}

export interface GenerationResult {
  aiResponse: AIContentResponse;
  providerUsed: 'Gemini' | 'Groq' | 'Mock/Fallback';
  similarityScore: number;
  attempts: number;
}

export interface SubmissionResult {
  status: TaskStatus;
  submissionUrl: string;
  finalPublishedUrl?: string;
  requiresManualActionReason?: string;
  error?: string;
  submittedAt: string;
}

export interface VerificationResult {
  verified: boolean;
  status: TaskStatus;
  httpStatusCode?: number;
  contentFound: boolean;
  targetUrlFound: boolean;
  message: string;
}

export interface ProcessedTaskResult {
  task: TaskInput;
  generation?: GenerationResult;
  submission?: SubmissionResult;
  verification?: VerificationResult;
  status: TaskStatus;
  error?: string;
}

export interface SubmissionCredentials {
  username?: string;
  password?: string;
  loginUrl?: string;
  siteCredentials?: Record<string, { username?: string; password?: string; loginUrl?: string }>;
}

export interface CLIOptions {
  input: string;
  output?: string;
  dryRun?: boolean;
  concurrency?: number;
  siteUrl?: string;
}

