import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { ExcelService } from './services/excelService';
import { AIService } from './services/aiService';
import { UniquenessService } from './services/uniquenessService';
import { SubmissionAdapter } from './services/submissionAdapter';
import { VerificationService } from './services/verificationService';
import { ProcessedTaskResult, TaskStatus, CLIOptions } from './types';

dotenv.config();

const program = new Command();

program
  .name('seo-automation')
  .description('SEO Submission Automation Backend MVP CLI')
  .version('1.0.0')
  .requiredOption('-i, --input <path>', 'Path to input Excel file (.xlsx)')
  .option('-o, --output <path>', 'Path to save output Excel file (.xlsx)')
  .option('-d, --dry-run', 'Execute generation and verification in dry-run mode without external posting', false)
  .option('-s, --site-url <url>', 'Override target site URL for testing');

program.parse(process.argv);
const options = program.opts<CLIOptions>();

async function runPipeline() {
  console.log(`\n======================================================`);
  console.log(`🚀 SEO SUBMISSION AUTOMATION PIPELINE (MVP CLI)`);
  console.log(`======================================================\n`);

  const inputPath = path.resolve(options.input);
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file not found at: ${inputPath}`);
    process.exit(1);
  }

  const outputPath = options.output
    ? path.resolve(options.output)
    : path.resolve(`results_${Date.now()}.xlsx`);

  const similarityThreshold = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.70');
  const maxRegenRetries = parseInt(process.env.MAX_REGEN_RETRIES || '2', 10);

  // Initialize Services
  const aiService = new AIService();
  const uniquenessService = new UniquenessService();
  const submissionAdapter = new SubmissionAdapter();
  const verificationService = new VerificationService();

  console.log(`📂 Reading input tasks from: ${inputPath}...`);
  const tasks = await ExcelService.readTasks(inputPath);
  console.log(`📋 Total valid tasks loaded: ${tasks.length}`);

  if (tasks.length === 0) {
    console.warn(`⚠️ No tasks found in input Excel file.`);
    return;
  }

  const results: ProcessedTaskResult[] = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (options.siteUrl) {
      task.targetSite = options.siteUrl;
    }

    console.log(`\n------------------------------------------------------`);
    console.log(`🔹 [Task ${i + 1}/${tasks.length}] Row ${task.rowIndex}`);
    console.log(`   Keyword: "${task.keyword}" | Type: ${task.contentType} | Site: ${task.targetSite}`);
    console.log(`------------------------------------------------------`);

    try {
      // Step 1: AI Content Generation & Uniqueness Checks
      let generationResult = await aiService.generateContent(task);
      let uniquenessCheck = uniquenessService.checkUniqueness(
        generationResult.aiResponse.content,
        similarityThreshold
      );

      let retryCount = 0;
      while (!uniquenessCheck.isUnique && retryCount < maxRegenRetries) {
        retryCount++;
        console.warn(`⚠️ Content similarity ${(uniquenessCheck.maxSimilarity * 100).toFixed(1)}% exceeds threshold (${(similarityThreshold * 100)}%). Regenerating (Attempt ${retryCount}/${maxRegenRetries})...`);
        
        const regenNote = `CRITICAL: Previous output was too similar to "${uniquenessCheck.matchedTitle}". Re-write with completely different vocabulary, phrasing, and paragraph order.`;
        generationResult = await aiService.generateContent(task, regenNote);
        generationResult.attempts = retryCount + 1;

        uniquenessCheck = uniquenessService.checkUniqueness(
          generationResult.aiResponse.content,
          similarityThreshold
        );
      }

      generationResult.similarityScore = uniquenessCheck.maxSimilarity;

      if (!uniquenessCheck.isUnique) {
        console.warn(`⚠️ Warning: Content retained similarity score of ${(uniquenessCheck.maxSimilarity * 100).toFixed(1)}% after max retries.`);
      } else {
        console.log(`✅ Uniqueness verified (Similarity score: ${(uniquenessCheck.maxSimilarity * 100).toFixed(1)}%).`);
      }

      // Save to uniqueness history
      uniquenessService.saveToHistory(
        task.keyword,
        task.contentType,
        generationResult.aiResponse.title,
        generationResult.aiResponse.content
      );

      console.log(`💡 Generated Title: "${generationResult.aiResponse.title}"`);
      console.log(`🤖 Provider Used: ${generationResult.providerUsed}`);

      // Step 2: Submission
      const submissionResult = await submissionAdapter.submitContent(
        task,
        generationResult.aiResponse,
        options.dryRun
      );

      console.log(`📤 Submission Status: ${submissionResult.status}`);

      // Step 3: Verification
      let verificationResult = undefined;
      let finalStatus: TaskStatus = submissionResult.status;

      if (submissionResult.finalPublishedUrl && submissionResult.status === 'PUBLISHED') {
        verificationResult = await verificationService.verifyPublishedUrl(
          submissionResult.finalPublishedUrl,
          generationResult.aiResponse.title,
          generationResult.aiResponse.target_url
        );

        finalStatus = verificationResult.status;
        console.log(`🔍 Live Verification Status: ${finalStatus} (${verificationResult.message})`);
      }

      results.push({
        task,
        generation: generationResult,
        submission: submissionResult,
        verification: verificationResult,
        status: finalStatus,
      });

    } catch (taskErr: any) {
      console.error(`❌ Row ${task.rowIndex} processing failed: ${taskErr.message}`);
      results.push({
        task,
        status: 'FAILED',
        error: taskErr.message,
      });
    }
  }

  // Step 4: Write Final Results to Excel
  console.log(`\n======================================================`);
  console.log(`💾 Writing final results to Excel: ${outputPath}`);
  await ExcelService.writeResults(outputPath, results);
  console.log(`✅ Excel report successfully generated!`);

  // Summary Report
  const publishedCount = results.filter((r) => r.status === 'PUBLISHED').length;
  const manualCount = results.filter((r) => r.status === 'REQUIRES_MANUAL_ACTION').length;
  const moderationCount = results.filter((r) => r.status === 'PENDING_MODERATION').length;
  const failedCount = results.filter((r) => r.status === 'FAILED' || r.status === 'VERIFICATION_FAILED').length;

  console.log(`\n📊 SUMMARY REPORT:`);
  console.log(`------------------------------------------------------`);
  console.log(`- Total Tasks Processed: ${results.length}`);
  console.log(`- Published & Verified: ${publishedCount}`);
  console.log(`- Pending Moderation:   ${moderationCount}`);
  console.log(`- Requires Manual Action:${manualCount}`);
  console.log(`- Failed:               ${failedCount}`);
  console.log(`======================================================\n`);
}

runPipeline().catch((err) => {
  console.error(`💥 Pipeline execution crashed: ${err.message}`);
  process.exit(1);
});
