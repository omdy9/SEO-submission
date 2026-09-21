import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import { TaskInput, AIContentResponse, GenerationResult } from '../types';

dotenv.config();

export class AIService {
  private geminiClient: GoogleGenerativeAI | null = null;
  private groqClient: Groq | null = null;

  constructor() {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey.trim() !== '') {
      this.geminiClient = new GoogleGenerativeAI(geminiKey);
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey && groqKey.trim() !== '') {
      this.groqClient = new Groq({ apiKey: groqKey });
    }
  }

  /**
   * Helper to extract clean company / brand name from keywordWebsite URL.
   * e.g. "https://www.eximadvisory.com" -> "Exim Advisory"
   */
  private static extractCompanyName(urlStr?: string): string {
    if (!urlStr || !urlStr.trim()) return 'Exim Advisory';
    try {
      const url = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
      let host = url.hostname.replace(/^www\./, '');
      const parts = host.split('.');
      const domainName = parts[0] || host;

      return domainName
        .replace(/[-_]+/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    } catch {
      return 'Exim Advisory';
    }
  }

  /**
   * Generates AI content with primary Gemini API, fallback Groq API, and fallback mock generator.
   */
  public async generateContent(
    task: TaskInput,
    regenerationNote?: string
  ): Promise<GenerationResult> {
    const prompt = this.buildPrompt(task, regenerationNote);

    // 1. Try Gemini API
    if (this.geminiClient) {
      try {
        console.log(`🤖 Attempting content generation with Gemini API for row ${task.rowIndex} (${task.keyword})...`);
        const aiResponse = await this.callGemini(prompt);
        return {
          aiResponse,
          providerUsed: 'Gemini',
          similarityScore: 0,
          attempts: 1,
        };
      } catch (err: any) {
        console.warn(`⚠️ Gemini API error: ${err.message}. Falling back to Groq API...`);
      }
    }

    // 2. Try Groq API Fallback
    if (this.groqClient) {
      try {
        console.log(`🤖 Attempting content generation with Groq API for row ${task.rowIndex}...`);
        const aiResponse = await this.callGroq(prompt);
        return {
          aiResponse,
          providerUsed: 'Groq',
          similarityScore: 0,
          attempts: 1,
        };
      } catch (err: any) {
        console.warn(`⚠️ Groq API error: ${err.message}.`);
      }
    }

    // 3. Clean Mock/Fallback Generation for local testing when no API keys are provided
    console.log(`ℹ️ Utilizing dynamic mock generator for testing...`);
    const aiResponse = this.generateMockContent(task, regenerationNote);
    return {
      aiResponse,
      providerUsed: 'Mock/Fallback',
      similarityScore: 0,
      attempts: 1,
    };
  }

  private buildPrompt(task: TaskInput, regenerationNote?: string): string {
    const keywordWebsite = task.keywordWebsite || '';
    const companyName = AIService.extractCompanyName(keywordWebsite);

    let hyperlinkInstruction = '';
    if (keywordWebsite) {
      hyperlinkInstruction = `
CRITICAL HYPERLINK RULE:
- In the "content" and "short_description" fields, the FIRST occurrence of the main keyword "${task.keyword}" MUST be wrapped as an HTML hyperlink pointing to "${keywordWebsite}".
- Use this exact format: <a href="${keywordWebsite}">${task.keyword}</a>
- Only hyperlink it ONCE (the first mention). All other mentions should be plain text.`;
    }

    let typeInstructions = '';
    switch (task.contentType) {
      case 'Bookmarking':
        typeInstructions = `Format: Social Bookmarking post.
Requirements:
- Catchy, professional title. DO NOT include raw row numbers or hashtags (no #1001, no #1, etc.).
- Highlight "${companyName}" and its specific services for "${task.keyword}".
- Short description (100-160 characters summarizing ${companyName}'s value proposition).
- Main content: 2-3 unique paragraphs highlighting why ${companyName} is the preferred advisor.`;
        break;
      case 'Classifieds':
        typeInstructions = `Format: Online Classified Listing.
Requirements:
- Professional service offering title. DO NOT include row numbers or hashtags.
- Highlight ${companyName}'s service breakdown for "${task.keyword}", key benefits, and CTA pointing to ${keywordWebsite || task.targetSite}.`;
        break;
      case 'Blogs':
        typeInstructions = `Format: Engaging Blog Article.
Requirements:
- Natural blog article title. DO NOT include row numbers or hashtags.
- Content tailored around ${companyName}'s industry authority and solutions for "${task.keyword}".`;
        break;
      case 'Articles':
      default:
        typeInstructions = `Format: In-depth Informative Article.
Requirements:
- Authoritative article title. DO NOT include row numbers or hashtags.
- Detailed article featuring ${companyName} as the expert authority for "${task.keyword}".`;
        break;
    }

    return `You are a world-class SEO copywriter. Generate 100% original, unique content:

Target Keyword: "${task.keyword}"
Company Name: "${companyName}"
Company Website / Destination Link: "${keywordWebsite || 'N/A'}"
Content Type: "${task.contentType}"
Target Submission Website: "${task.targetSite}"

TITLE REQUIREMENT:
- Create a completely natural, compelling title for ${companyName} and "${task.keyword}".
- DO NOT add prefix numbers like #1001 or #1 in front of titles.

COMPANY & KEYWORD ALIGNMENT:
- All generated content MUST be explicitly tailored to "${companyName}" and its services related to "${task.keyword}".
${hyperlinkInstruction}

${typeInstructions}

${regenerationNote ? `CRITICAL UNIQUENESS INSTRUCTION:\n${regenerationNote}` : ''}

Return ONLY raw valid JSON:
{
  "title": "String",
  "content": "String (may contain HTML <a> hyperlink for the keyword pointing to ${keywordWebsite})",
  "short_description": "String",
  "category": "String",
  "tags": ["tag1", "tag2", "tag3"],
  "target_url": "${keywordWebsite || task.targetSite}"
}`;
  }

  private async callGemini(prompt: string): Promise<AIContentResponse> {
    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const model = this.geminiClient!.getGenerativeModel({ model: modelName });
    const response = await model.generateContent(prompt);
    const text = response.response.text();
    return this.parseAndValidateJSON(text);
  }

  private async callGroq(prompt: string): Promise<AIContentResponse> {
    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    const chatCompletion = await this.groqClient!.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are an expert SEO content generator. Return only raw JSON.' },
        { role: 'user', content: prompt },
      ],
      model,
      response_format: { type: 'json_object' },
    });

    const text = chatCompletion.choices[0]?.message?.content || '';
    return this.parseAndValidateJSON(text);
  }

  private parseAndValidateJSON(rawText: string): AIContentResponse {
    try {
      let jsonString = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

      const firstBrace = jsonString.indexOf('{');
      const lastBrace = jsonString.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1);
      }

      const parsed = JSON.parse(jsonString);

      const title = parsed.title ? String(parsed.title).trim() : '';
      const content = parsed.content ? String(parsed.content).trim() : '';

      if (!title && !content) {
        throw new Error('AI response JSON missing required fields "title" or "content"');
      }

      let shortDescription = parsed.short_description ? String(parsed.short_description).trim() : '';
      if (!shortDescription) {
        if (content) {
          const plainText = content.replace(/<[^>]+>/g, '');
          shortDescription = plainText.length > 150 ? `${plainText.substring(0, 147)}...` : plainText;
        } else {
          shortDescription = title;
        }
      }

      return {
        title: title || 'SEO Content Title',
        content: content || 'SEO Body Content',
        short_description: shortDescription,
        category: String(parsed.category || 'Business Consultancy').trim(),
        tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : ['SEO', 'Services'],
        target_url: String(parsed.target_url || ''),
      };
    } catch (e: any) {
      throw new Error(`Failed to parse AI JSON response: ${e.message}`);
    }
  }

  /**
   * Generates highly dynamic, 100% unique mock content per row across titles, intros, body content, and descriptions.
   */
  private generateMockContent(task: TaskInput, regenerationNote?: string): AIContentResponse {
    const companyName = AIService.extractCompanyName(task.keywordWebsite);
    const locMatch = task.keyword.match(/in\s+([A-Za-z]+)/i);
    const location = locMatch ? locMatch[1] : 'India';
    const keywordWebsite = task.keywordWebsite || task.targetSite;

    const keywordLink = task.keywordWebsite
      ? `<a href="${task.keywordWebsite}">${task.keyword}</a>`
      : task.keyword;

    // Create a seed based on row index and targetSite
    const siteHash = (task.targetSite || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const seed = task.rowIndex * 13 + siteHash;

    const titleTemplates = [
      `Top-Rated ${task.keyword} Solutions by ${companyName}`,
      `How ${companyName} Delivers Proven ${task.keyword} Expertise`,
      `Essential Guide to ${task.keyword} with ${companyName}`,
      `${companyName}: Professional ${task.keyword} Advisory & Consultancy`,
      `Streamline Foreign Trade with ${companyName} (${task.keyword})`,
      `Key Benefits of Partnering with ${companyName} for ${task.keyword}`,
      `Comprehensive ${task.keyword} Services Offered by ${companyName}`,
      `Why ${companyName} is the Leading Choice for ${task.keyword}`,
      `Navigating Import-Export Regulations with ${companyName} (${task.keyword})`,
      `Fast-Track Documentation & ${task.keyword} Assistance by ${companyName}`,
      `Maximize Duty Savings & Compliance with ${companyName} - ${task.keyword}`,
      `Expert Advice on ${task.keyword} from the Specialists at ${companyName}`,
    ];

    const intros = [
      `Establishing a strong trade presence requires reliable advisory. Discover how ${keywordLink} services from ${companyName} empower enterprises in ${location}.`,
      `Navigating complex export-import procedures can be daunting. ${companyName} offers dedicated, hands-on support for ${keywordLink} tailored to your business needs.`,
      `For companies seeking seamless licensing and trade compliance, ${companyName} provides specialized guidance for ${keywordLink} across ${location}.`,
      `Managing DGFT filings and trade documentation demands specialized expertise. ${companyName} delivers tailored solutions for ${keywordLink}.`,
      `Optimize your international trade operations with expert ${keywordLink} guidance and regulatory filing support from ${companyName}.`,
      `Accelerate your trade growth in ${location} by leveraging professional ${keywordLink} solutions provided by ${companyName}.`,
    ];

    const bodyTemplates = [
      `${companyName} handles all aspects of IEC code updates, advance licenses, EPCG authorizations, and duty drawbacks in ${location}. Their experienced team ensures accurate submission and rapid clearance at every step.`,
      `With years of domain experience, ${companyName} assists enterprises in overcoming regulatory hurdles, auditing trade paperwork, and maximizing eligible government incentive schemes effortlessly.`,
      `From customs documentation to DGFT portal representations, ${companyName} equips exporters and importers in ${location} with strategic advisory tailored to regional market demands.`,
      `By leveraging specialized industry knowledge, ${companyName} streamlines documentation workflows, minimizes audit risks, and accelerates overall international business expansion.`,
      `The team at ${companyName} delivers end-to-end guidance on export incentives, SION norm fixes, and policy compliance, giving businesses in ${location} a distinct competitive advantage.`,
      `${companyName} combines deep regulatory insights with proactive client support, helping organizations meet strict compliance deadlines while optimizing tariff advantages.`,
    ];

    const ctas = [
      `To explore full service details and book a consultation with ${companyName}, visit ${keywordWebsite}.`,
      `Get in touch with ${companyName}'s advisory team today at ${keywordWebsite} for a customized trade assessment.`,
      `Discover how ${companyName} can streamline your trade operations by visiting ${keywordWebsite}.`,
      `For expert assistance and tailored regulatory solutions, visit ${companyName} at ${keywordWebsite}.`,
    ];

    const descTemplates = [
      `Explore professional ${keywordLink} services by ${companyName} in ${location} for seamless trade documentation and licensing compliance.`,
      `${companyName} provides trusted ${keywordLink} solutions in ${location}, helping businesses optimize DGFT filings and tariff benefits.`,
      `Discover top-rated ${keywordLink} consultancy from ${companyName} for complete export-import documentation and policy advisory in ${location}.`,
      `Streamline your regulatory approvals with ${companyName}'s expert ${keywordLink} advisory services tailored for businesses in ${location}.`,
    ];

    const title = titleTemplates[seed % titleTemplates.length];
    const intro = intros[seed % intros.length];
    const body = bodyTemplates[(seed + 1) % bodyTemplates.length];
    const cta = ctas[(seed + 2) % ctas.length];
    const short_description = descTemplates[seed % descTemplates.length];

    return {
      title,
      content: `${intro}\n\n${body}\n\n${cta}`,
      short_description,
      category: 'Business Consultancy',
      tags: ['DGFT', 'Consultant', location, companyName, task.contentType],
      target_url: keywordWebsite,
    };
  }
}
