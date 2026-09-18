import fs from 'fs';
import path from 'path';

interface HistoryItem {
  id: string;
  keyword: string;
  contentType: string;
  title: string;
  content: string;
  createdAt: string;
}

export class UniquenessService {
  private storageDir: string;
  private historyFilePath: string;
  private history: HistoryItem[] = [];

  constructor() {
    this.storageDir = path.join(process.cwd(), '.storage');
    this.historyFilePath = path.join(this.storageDir, 'history.json');
    this.initStorage();
  }

  private initStorage(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

    if (fs.existsSync(this.historyFilePath)) {
      try {
        const raw = fs.readFileSync(this.historyFilePath, 'utf-8');
        this.history = JSON.parse(raw);
      } catch (err) {
        this.history = [];
      }
    } else {
      this.history = [];
      fs.writeFileSync(this.historyFilePath, JSON.stringify([]));
    }
  }

  /**
   * Evaluates uniqueness of candidate content against history using TF-IDF / Cosine Similarity.
   */
  public checkUniqueness(
    content: string,
    threshold: number = 0.70
  ): { isUnique: boolean; maxSimilarity: number; matchedTitle?: string } {
    if (this.history.length === 0) {
      return { isUnique: true, maxSimilarity: 0 };
    }

    const candidateTokens = this.tokenize(content);
    let maxSim = 0;
    let matchedTitle: string | undefined = undefined;

    for (const item of this.history) {
      const historyTokens = this.tokenize(item.content);
      const sim = this.calculateCosineSimilarity(candidateTokens, historyTokens);

      if (sim > maxSim) {
        maxSim = sim;
        matchedTitle = item.title;
      }
    }

    return {
      isUnique: maxSim <= threshold,
      maxSimilarity: maxSim,
      matchedTitle,
    };
  }

  /**
   * Stores approved unique content into local history.
   */
  public saveToHistory(keyword: string, contentType: string, title: string, content: string): void {
    const newItem: HistoryItem = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      keyword,
      contentType,
      title,
      content,
      createdAt: new Date().toISOString(),
    };

    this.history.push(newItem);
    fs.writeFileSync(this.historyFilePath, JSON.stringify(this.history, null, 2));
  }

  /**
   * Tokenizes text into word n-grams, removing stop words and punctuation.
   */
  private tokenize(text: string): Map<string, number> {
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'to', 'in', 'for', 'of', 'or', 'by', 'with', 'this',
      'that', 'it', 'from', 'as', 'are', 'be', 'your', 'our', 'all', 'can', 'has', 'have', 'service', 'services'
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

    const freqMap = new Map<string, number>();
    for (const w of words) {
      freqMap.set(w, (freqMap.get(w) || 0) + 1);
    }
    return freqMap;
  }

  /**
   * Computes Cosine Similarity between term frequency maps.
   */
  private calculateCosineSimilarity(mapA: Map<string, number>, mapB: Map<string, number>): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const val of mapA.values()) {
      normA += val * val;
    }
    for (const val of mapB.values()) {
      normB += val * val;
    }

    if (normA === 0 || normB === 0) return 0;

    for (const [term, freqA] of mapA.entries()) {
      const freqB = mapB.get(term);
      if (freqB) {
        dotProduct += freqA * freqB;
      }
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
