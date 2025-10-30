import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { Regex, RegexAuditStatus } from './entities/regex.entity';
import { Bank } from '../bank/entities/bank.entity';
import { RegexAuditResult, RegexExtractionResult } from './interfaces/regex-result.interface';
import { OpenAIConfig } from '../common/configurations/openai.config';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';

@Injectable()
export class RegexService {
  private readonly logger = new Logger(RegexService.name);

  constructor(
    @InjectRepository(Regex)
    private readonly regexRepository: Repository<Regex>,
    @InjectRepository(Bank)
    private readonly bankRepository: Repository<Bank>,
    private readonly openAI: OpenAIConfig,
  ) {}

  /* -------------------------------------------------------------------------- */
  /*                                MAIN FLOW                                   */
  /* -------------------------------------------------------------------------- */

  /**
   * Attempts extraction using existing regex.
   * If none found or extraction fails -> fallback to LLM-based creation + audit.
   */

  async extractOrGenerateRegex(emailText: string, bank: Bank): Promise<RegexExtractionResult> {
    const existingRegex = await this.findActiveRegexByBank(bank.id);

    if (existingRegex) {
      const extracted = await this.extractWithRegex(emailText, existingRegex);
      if (extracted.success) return extracted;
    }

    this.logger.warn(`No valid regex found for bank ${bank.name}. Using LLM fallback...`);

    const extractedData = await this.extractWithLLM(emailText);

    const generatedPattern = await this.generateRegexPattern(emailText, extractedData, bank.id);
    const auditResult = await this.auditRegexPattern(emailText, generatedPattern, extractedData);
    const newRegex = await this.createRegexPattern(bank.id, generatedPattern, auditResult);

    // Attempt extraction again using the new pattern
    return this.extractWithRegex(emailText, newRegex);
  }

  /* -------------------------------------------------------------------------- */
  /*                            DATABASE HELPERS                                */
  /* -------------------------------------------------------------------------- */

  async findActiveRegexByBank(bankId: number): Promise<Regex | null> {
    return this.regexRepository.findOne({
      where: { bank: { id: bankId }, isActive: true, auditStatus: RegexAuditStatus.APPROVED },
      relations: ['bank'],
      order: { successCount: 'DESC' },
    });
  }

  /* -------------------------------------------------------------------------- */
  /*                             REGEX EXTRACTION                               */
  /* -------------------------------------------------------------------------- */

  async extractWithRegex(emailText: string, regex: Regex): Promise<RegexExtractionResult> {
    try {
      this.logger.log(
        `Attempting regex extraction for bank ${regex.bank.name} (pattern ID: ${regex.id})`,
      );

      const extracted: Record<string, unknown> = {};
      const text = this.normalizeText(emailText);
      // All fields required for successful regex extraction
      const OPTIONAL_FIELDS = new Set<string>();
      let extractionFailed = false;
      const fieldStatuses: Array<{
        field: string;
        matched: boolean;
        pattern: string;
        captureCount: number;
        error?: string;
        debugSnippet?: string;
      }> = [];

      const wantDebug = (process.env.LOG_LEVEL || '').toLowerCase() === 'debug';
      const SNIPPET_RADIUS = 40; // characters around the match index

      for (const [field, rawPattern] of Object.entries(regex.pattern)) {
        const strPattern = String(rawPattern ?? '');
        const captureCount = (strPattern.match(/\((?!\?)/g) || []).length; // count true captures
        try {
          const safePattern = this.makeSingleCapturingPattern(strPattern);
          const flags = 'is';
          const re = new RegExp(safePattern, flags);
          const match = re.exec(text);
          if (match && match[1]) {
            extracted[field] = String(match[1]).trim();
            const status: (typeof fieldStatuses)[number] = {
              field,
              matched: true,
              pattern: strPattern,
              captureCount,
            };
            if (wantDebug && match.index !== undefined) {
              const start = Math.max(0, match.index - SNIPPET_RADIUS);
              const end = Math.min(text.length, match.index + SNIPPET_RADIUS);
              status.debugSnippet = `...${text.slice(start, end)}...`;
            }
            fieldStatuses.push(status);
            if (wantDebug) this.logger.debug(`Field '${field}' matched. Flags=${flags}`);
          } else {
            const isOptional = OPTIONAL_FIELDS.has(field);
            if (!isOptional) extractionFailed = true;
            const status: (typeof fieldStatuses)[number] = {
              field,
              matched: false,
              pattern: strPattern,
              captureCount,
            };
            if (wantDebug) {
              status.debugSnippet = '(no match)';
              this.logger.debug(
                `Field '${field}' did not match. Flags=${flags} | optional=${isOptional}`,
              );
            }
            fieldStatuses.push(status);
          }
        } catch (err) {
          extractionFailed = true;
          fieldStatuses.push({
            field,
            matched: false,
            pattern: strPattern,
            captureCount,
            error: (err as Error).message,
          });
          this.logger.warn(`Regex error on field '${String(field)}': ${(err as Error).message}`);
        }
      }

      // Log a concise summary (no raw values)
      const totalFields = fieldStatuses.length;
      const matchedFields = fieldStatuses.filter((s) => s.matched).map((s) => s.field);
      const missingRequired = fieldStatuses
        .filter((s) => !s.matched && !OPTIONAL_FIELDS.has(s.field))
        .map((s) => s.field);
      const missingOptional = fieldStatuses
        .filter((s) => !s.matched && OPTIONAL_FIELDS.has(s.field))
        .map((s) => s.field);
      const withBadCaptures = fieldStatuses.filter((s) => s.captureCount !== 1).map((s) => s.field);

      if (missingRequired.length > 0) {
        this.logger.warn(
          `Regex extraction summary (ID=${regex.id}, bank=${regex.bank.name}): matched ${matchedFields.length}/${totalFields}. Missing required: ${missingRequired.join(', ')}${
            missingOptional.length ? ` | Missing optional: ${missingOptional.join(', ')}` : ''
          }`,
        );
      } else if (missingOptional.length > 0) {
        this.logger.warn(
          `Regex extraction summary (ID=${regex.id}, bank=${regex.bank.name}): matched ${matchedFields.length}/${totalFields}. Missing optional: ${missingOptional.join(', ')}`,
        );
      }
      if (withBadCaptures.length > 0) {
        this.logger.warn(
          `Fields with non-single capturing groups: ${withBadCaptures.join(', ')}. Consider auditing patterns.`,
        );
      }

      // numeric coercion (guard non-strings)
      const amountRaw = (extracted as { amount?: unknown }).amount;
      if (typeof amountRaw === 'string' || typeof amountRaw === 'number') {
        (extracted as { amount?: number }).amount = Number(String(amountRaw).replace(/,/g, ''));
      }
      const balRaw = (extracted as { currentBalance?: unknown }).currentBalance;
      if (typeof balRaw === 'string' || typeof balRaw === 'number') {
        (extracted as { currentBalance?: number }).currentBalance = Number(
          String(balRaw).replace(/,/g, ''),
        );
      }

      // update success/failure metrics
      if (extractionFailed) {
        regex.failureCount += 1;
      } else {
        regex.successCount += 1;
      }
      regex.lastUsedAt = new Date();
      if (regex.failureCount + regex.successCount > 10) {
        const rate = regex.failureCount / (regex.successCount + regex.failureCount);
        if (rate > 0.3) regex.isActive = false;
      }
      await this.regexRepository.save(regex);

      if (extractionFailed) {
        const errorMsg = `Partial or failed extraction. Missing required: ${missingRequired.join(', ')}`;
        return { success: false, error: errorMsg, regexId: regex.id };
      }

      return { success: true, data: extracted as RegexExtractionResult['data'], regexId: regex.id };
    } catch (err) {
      this.logger.error(`Regex extraction fatal: ${(err as Error).message}`);
      return { success: false, error: (err as Error).message };
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                        LLM EXTRACTION (FALLBACK)                           */
  /* -------------------------------------------------------------------------- */

  async generateRegexPattern(
    emailText: string,
    extractedData: unknown,
    bankId: number,
  ): Promise<Record<string, string>> {
    // Expect a record of string patterns
    const schema = z.record(z.string(), z.string());

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        'You generate JavaScript regex patterns for extracting transaction data from bank notifications. Return only valid JSON object mapping field -> regex string. Each field must have exactly one capturing group. If unsure, set the value to an empty string. Do NOT include markdown.',
      ],
      ['user', 'Email:\n{emailText}\n\nExtracted Data:\n{extractedData}'],
    ]);

    const chain = prompt.pipe(this.openAI.getLLM());
    let raw: unknown;
    try {
      raw = await chain.invoke({
        emailText: this.normalizeText(emailText),
        extractedData: JSON.stringify(extractedData ?? {}, null, 2),
      });
    } catch (e) {
      this.logger.warn(`LLM generateRegexPattern error: ${(e as Error).message}`);
      return this.autoFixPatterns({});
    }

    const text = (raw as { content?: unknown }).content;
    const json = typeof text === 'string' ? text : Array.isArray(text) ? String(text[0] ?? '') : '';

    let candidate: unknown;
    try {
      candidate = JSON.parse(json);
    } catch {
      candidate = {};
    }

    const parsed = schema.safeParse(candidate);
    let result: Record<string, string> = {};
    if (parsed.success) {
      result = parsed.data;
    }

    const fixed = this.autoFixPatterns(result);
    const bank = await this.bankRepository.findOne({ where: { id: bankId } });
    if (bank?.name) fixed.bankName = `(${this.escapeRegExp(bank.name)})`;

    return fixed;
  }

  /* -------------------------------------------------------------------------- */
  /*                           REGEX GENERATION LLM                             */
  /* -------------------------------------------------------------------------- */

  async auditRegexPattern(
    emailText: string,
    regexPattern: Record<string, string>,
    extractedData: unknown,
  ): Promise<RegexAuditResult> {
    const hash = createHash('sha256').update(JSON.stringify(regexPattern)).digest('hex');

    // Use query builder to avoid strict generic property typing issues in FindOptionsWhere
    const cached = await this.regexRepository
      .createQueryBuilder('r')
      .where('r.patternHash = :hash', { hash })
      .getOne();

    if (cached && cached.auditStatus === RegexAuditStatus.APPROVED) {
      this.logger.log(`Skipping audit for existing approved regex (hash=${hash})`);
      return {
        isValid: true,
        confidenceScore: Number(cached.confidenceScore),
        notes: 'Previously approved pattern reused',
      };
    }

    const auditSchema = z.object({
      isValid: z.boolean(),
      confidenceScore: z.number().min(0).max(100),
      notes: z.string(),
    });

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        'Audit these JavaScript regex patterns for accuracy and syntax validity. Ensure only one capturing group per field. Return JSON with keys: isValid, confidenceScore, notes.',
      ],
      ['user', 'Email:\n{emailText}\nRegex:\n{regexPattern}\nExpected Data:\n{extractedData}'],
    ]);

    const chain = prompt.pipe(this.openAI.getChatModel('gpt-4o'));
    let raw: unknown;
    try {
      raw = await chain.invoke({
        emailText,
        regexPattern: JSON.stringify(regexPattern, null, 2),
        extractedData: JSON.stringify(extractedData ?? {}, null, 2),
      });
    } catch (e) {
      this.logger.warn(`LLM audit error: ${(e as Error).message}`);
      return { isValid: false, confidenceScore: 0, notes: 'Audit call failed' };
    }

    const text = (raw as { content?: unknown }).content;
    const json = typeof text === 'string' ? text : Array.isArray(text) ? String(text[0] ?? '') : '';

    let candidate: unknown;
    try {
      candidate = JSON.parse(json);
    } catch {
      candidate = {};
    }
    const parsed = auditSchema.safeParse(candidate);
    return parsed.success
      ? parsed.data
      : { isValid: false, confidenceScore: 0, notes: 'Audit parsing failed' };
  }

  /* -------------------------------------------------------------------------- */
  /*                              REGEX AUDITING                                */
  /* -------------------------------------------------------------------------- */

  async createRegexPattern(
    bankId: number,
    pattern: Record<string, string>,
    auditResult: { isValid: boolean; confidenceScore: number; notes: string },
  ): Promise<Regex> {
    const bank = await this.bankRepository.findOne({ where: { id: bankId } });
    if (!bank) throw new Error(`Bank ${bankId} not found`);

    const patternHash = createHash('sha256').update(JSON.stringify(pattern)).digest('hex');

    // Build entity via assignment to avoid DeepPartial strictness complaints
    const regex = this.regexRepository.create();
    regex.bank = bank;
    regex.pattern = pattern;
    regex.patternHash = patternHash;
    regex.confidenceScore = auditResult.confidenceScore;
    regex.auditStatus = auditResult.isValid ? RegexAuditStatus.APPROVED : RegexAuditStatus.REJECTED;
    regex.auditNotes = auditResult.notes;
    regex.isActive = auditResult.isValid && auditResult.confidenceScore >= 70;

    await this.regexRepository.save(regex);
    this.logger.log(`Saved new regex for ${bank.name} (confidence=${auditResult.confidenceScore})`);
    return regex;
  }

  /* -------------------------------------------------------------------------- */
  /*                            SAVE + VALIDATION                               */
  /* -------------------------------------------------------------------------- */

  // Minimal extractor used only when no valid regex exists or regex fails
  private async extractWithLLM(emailText: string): Promise<Record<string, unknown>> {
    const schema = z
      .object({
        type: z.string().optional(),
        amount: z.string().or(z.number()).optional(),
        currency: z.string().optional(),
        date: z.string().optional(),
        description: z.string().optional(),
        currentBalance: z.string().or(z.number()).optional(),
        transactionId: z.string().optional(),
        accountNumber: z.string().optional(),
        accountName: z.string().optional(),
        bankName: z.string().optional(),
      })
      .passthrough();

    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        'Extract structured transaction fields from the email. Return strict JSON with keys among type, amount, currency, date, description, currentBalance, transactionId, accountNumber, accountName, bankName. If unknown, omit the key.',
      ],
      ['user', '{email}'],
    ]);

    const chain = prompt.pipe(this.openAI.getLLM());
    let raw: unknown;
    try {
      raw = await chain.invoke({ email: this.normalizeText(emailText) });
    } catch (e) {
      this.logger.warn(`LLM extract error: ${(e as Error).message}`);
      return {};
    }
    // raw is of type AIMessage; we extract the string JSON safely
    const text = (raw as { content?: unknown }).content;
    const json = typeof text === 'string' ? text : Array.isArray(text) ? String(text[0] ?? '') : '';

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      // fallback to empty object to avoid blocking
      parsed = {};
    }
    const safe = schema.safeParse(parsed);
    return safe.success ? safe.data : {};
  }

  /* -------------------------------------------------------------------------- */
  /*                               HELPERS                                      */
  /* -------------------------------------------------------------------------- */

  private normalizeText(input: string): string {
    return input
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/[ \u00A0]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private makeSingleCapturingPattern(pat: string): string {
    if (!pat) return '(.*)';
    const captureCount = (pat.match(/\((?!\?)/g) || []).length;
    if (captureCount === 1) return pat;
    if (captureCount === 0) return `(${pat})`;
    const sanitized = pat.replace(/\((?!\?)/g, '(?:'); // convert inner to non-capturing
    return `(${sanitized})`;
  }

  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private autoFixPatterns(p: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = { ...p };
    if (!out.amount) out.amount = '(\\d+(?:,\\d{3})*(?:\\.\\d{1,2})?)';
    if (!out.currency) out.currency = '(USD|EUR|KES|NGN|GBP|\\$|€|₦|£)';
    if (!out.date) out.date = '([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}[/-][0-9]{2}[/-][0-9]{4})';
    return out;
  }
}
