/**
 * Unit tests for audition-agent.ts pre-check logic
 *
 * Tests cover: parseAgeRange, normaliseGender, and applyPreCheckPenalties
 * — the pure-function layer of the AI audition pipeline.
 */
import { describe, it, expect } from 'vitest'
import {
    parseAgeRange,
    normaliseGender,
    applyPreCheckPenalties,
    type AuditReport,
    type PreCheckResult,
} from './audition-agent'

// ── Test Helpers ──

function makeReport(overrides: Partial<AuditReport> = {}): AuditReport {
    return {
        overallScore: 80,
        roleFitScore: 75,
        strengths: ['Good personality fit'],
        concerns: [],
        recommendation: 'GOOD_FIT',
        notes: 'Solid applicant',
        applicantFeedback: 'Great job.',
        ...overrides,
    }
}

function makePreCheck(overrides: Partial<PreCheckResult> = {}): PreCheckResult {
    return {
        ageMismatch: false,
        ageDetails: '',
        genderMismatch: false,
        genderDetails: '',
        voiceMissing: false,
        voiceDetails: '',
        voiceHardRequired: false,
        totalPenalty: 0,
        preNotes: [],
        preConcerns: [],
        ...overrides,
    }
}

// ═══════════════════════════════════════════════════════════════
// parseAgeRange
// ═══════════════════════════════════════════════════════════════
describe('parseAgeRange', () => {
    it('should return null for null input', () => {
        expect(parseAgeRange(null)).toBeNull()
    })

    it('should return null for empty string', () => {
        expect(parseAgeRange('')).toBeNull()
    })

    it('should parse "18-35" range', () => {
        expect(parseAgeRange('18-35')).toEqual([18, 35])
    })

    it('should parse "18 - 35" with spaces', () => {
        expect(parseAgeRange('18 - 35')).toEqual([18, 35])
    })

    it('should parse en-dash "18–35"', () => {
        expect(parseAgeRange('18–35')).toEqual([18, 35])
    })

    it('should parse "25+" (plus notation)', () => {
        expect(parseAgeRange('25+')).toEqual([25, 120])
    })

    it('should parse "under 40"', () => {
        expect(parseAgeRange('under 40')).toEqual([0, 40])
    })

    it('should parse "maximum 30"', () => {
        expect(parseAgeRange('maximum 30')).toEqual([0, 30])
    })

    it('should parse single number "30" as ±5 range', () => {
        expect(parseAgeRange('30')).toEqual([25, 35])
    })

    it('should return null for non-numeric strings', () => {
        expect(parseAgeRange('any age')).toBeNull()
    })
})

// ═══════════════════════════════════════════════════════════════
// normaliseGender
// ═══════════════════════════════════════════════════════════════
describe('normaliseGender', () => {
    it('should return "any" for null', () => {
        expect(normaliseGender(null)).toBe('any')
    })

    it('should normalise "male" variants', () => {
        expect(normaliseGender('male')).toBe('male')
        expect(normaliseGender('Male')).toBe('male')
        expect(normaliseGender('man')).toBe('male')
        expect(normaliseGender('M')).toBe('male')
    })

    it('should normalise "female" variants', () => {
        expect(normaliseGender('female')).toBe('female')
        expect(normaliseGender('Female')).toBe('female')
        expect(normaliseGender('woman')).toBe('female')
        expect(normaliseGender('F')).toBe('female')
    })

    it('should return "any" for unrecognised values', () => {
        expect(normaliseGender('non-binary')).toBe('any')
        expect(normaliseGender('other')).toBe('any')
        expect(normaliseGender('')).toBe('any')
    })
})

// ═══════════════════════════════════════════════════════════════
// applyPreCheckPenalties
// ═══════════════════════════════════════════════════════════════
describe('applyPreCheckPenalties', () => {
    // ── Voice requirement tests ──

    it('should apply −5 penalty when requireVoice=false and voice missing', () => {
        const report = makeReport({ overallScore: 80, roleFitScore: 75 })
        const preCheck = makePreCheck({
            voiceMissing: true,
            voiceHardRequired: false,
            totalPenalty: 5,
            preConcerns: ['Missing voice recording'],
        })

        const result = applyPreCheckPenalties(report, preCheck)
        expect(result.overallScore).toBe(75)
        expect(result.roleFitScore).toBe(70)
        expect(result.recommendation).toBe('GOOD_FIT') // NOT capped
    })

    it('should apply −25 penalty and cap at WEAK_FIT when requireVoice=true and voice missing', () => {
        const report = makeReport({ overallScore: 80, roleFitScore: 75, recommendation: 'GOOD_FIT' })
        const preCheck = makePreCheck({
            voiceMissing: true,
            voiceHardRequired: true,
            totalPenalty: 25,
            preConcerns: ['Missing voice recording'],
        })

        const result = applyPreCheckPenalties(report, preCheck)
        expect(result.overallScore).toBe(55)
        expect(result.roleFitScore).toBe(50)
        expect(result.recommendation).toBe('WEAK_FIT')
        expect(result.concerns).toContain(
            'A voice/self-tape recording is required for this role and was not submitted. This is a disqualifying factor.'
        )
    })

    it('should not apply penalty when requireVoice=true and voice IS present', () => {
        const report = makeReport({ overallScore: 80, roleFitScore: 75, recommendation: 'GOOD_FIT' })
        const preCheck = makePreCheck({
            voiceMissing: false,
            voiceHardRequired: true,
            totalPenalty: 0, // voice is present → no penalty
        })

        const result = applyPreCheckPenalties(report, preCheck)
        expect(result.overallScore).toBe(80)
        expect(result.roleFitScore).toBe(75)
        expect(result.recommendation).toBe('GOOD_FIT')
    })

    it('should apply −25 penalty for corrupt voice file when requireVoice=true', () => {
        const report = makeReport({ overallScore: 70, roleFitScore: 65 })
        const preCheck = makePreCheck({
            voiceMissing: true,
            voiceHardRequired: true,
            voiceDetails: 'Voice/self-tape file appears to be empty or corrupt',
            totalPenalty: 25,
            preConcerns: ['Voice recording appears to be empty'],
        })

        const result = applyPreCheckPenalties(report, preCheck)
        expect(result.overallScore).toBe(45)
        expect(result.recommendation).toBe('WEAK_FIT')
    })

    // ── Age mismatch tests ──

    it('should apply −20 penalty for age mismatch', () => {
        const report = makeReport({ overallScore: 85, roleFitScore: 80, recommendation: 'STRONG_FIT' })
        const preCheck = makePreCheck({
            ageMismatch: true,
            ageDetails: 'Age 45 is outside required range 18-25',
            totalPenalty: 20,
            preConcerns: ['Age 45 is outside required range 18-25'],
        })

        const result = applyPreCheckPenalties(report, preCheck)
        expect(result.overallScore).toBe(65)
        expect(result.roleFitScore).toBe(60)
        // STRONG_FIT → capped to MODERATE
        expect(result.recommendation).toBe('MODERATE')
    })

    // ── Gender mismatch tests ──

    it('should apply −15 penalty for gender mismatch', () => {
        const report = makeReport({ overallScore: 90, roleFitScore: 85, recommendation: 'GOOD_FIT' })
        const preCheck = makePreCheck({
            genderMismatch: true,
            genderDetails: 'Applicant gender (male) does not match role requirement (female)',
            totalPenalty: 15,
            preConcerns: ['Gender mismatch'],
        })

        const result = applyPreCheckPenalties(report, preCheck)
        expect(result.overallScore).toBe(75)
        expect(result.roleFitScore).toBe(70)
        // GOOD_FIT → capped to MODERATE
        expect(result.recommendation).toBe('MODERATE')
    })

    // ── Combined penalty tests ──

    it('should accumulate penalties: age mismatch + voice missing with requireVoice=true → −45', () => {
        const report = makeReport({ overallScore: 80, roleFitScore: 75, recommendation: 'STRONG_FIT' })
        const preCheck = makePreCheck({
            ageMismatch: true,
            voiceMissing: true,
            voiceHardRequired: true,
            totalPenalty: 45, // 20 (age) + 25 (voice)
            preConcerns: ['Age mismatch', 'Missing voice recording'],
        })

        const result = applyPreCheckPenalties(report, preCheck)
        expect(result.overallScore).toBe(35)
        expect(result.roleFitScore).toBe(30)
        // Voice hard-requirement always wins → WEAK_FIT
        expect(result.recommendation).toBe('WEAK_FIT')
    })

    // ── Recommendation capping tests ──

    it('should cap STRONG_FIT to MODERATE on age mismatch', () => {
        const report = makeReport({ recommendation: 'STRONG_FIT' })
        const preCheck = makePreCheck({
            ageMismatch: true,
            totalPenalty: 20,
            preConcerns: ['Age outside range'],
        })

        const result = applyPreCheckPenalties(report, preCheck)
        expect(result.recommendation).toBe('MODERATE')
    })

    it('should cap GOOD_FIT to MODERATE on gender mismatch', () => {
        const report = makeReport({ recommendation: 'GOOD_FIT' })
        const preCheck = makePreCheck({
            genderMismatch: true,
            totalPenalty: 15,
            preConcerns: ['Gender does not match'],
        })

        const result = applyPreCheckPenalties(report, preCheck)
        expect(result.recommendation).toBe('MODERATE')
    })

    it('should leave MODERATE unchanged on age/gender mismatch', () => {
        const report = makeReport({ recommendation: 'MODERATE' })
        const preCheck = makePreCheck({
            ageMismatch: true,
            totalPenalty: 20,
            preConcerns: ['Age outside range'],
        })

        const result = applyPreCheckPenalties(report, preCheck)
        expect(result.recommendation).toBe('MODERATE')
    })

    // ── Zero penalty tests ──

    it('should return scores unchanged when no requirements are flagged', () => {
        const report = makeReport({ overallScore: 90, roleFitScore: 88, recommendation: 'STRONG_FIT' })
        const preCheck = makePreCheck() // all defaults → no penalty

        const result = applyPreCheckPenalties(report, preCheck)
        expect(result.overallScore).toBe(90)
        expect(result.roleFitScore).toBe(88)
        expect(result.recommendation).toBe('STRONG_FIT')
    })

    // ── Edge cases ──

    it('should clamp scores to 0 and never go negative', () => {
        const report = makeReport({ overallScore: 10, roleFitScore: 5 })
        const preCheck = makePreCheck({
            ageMismatch: true,
            voiceMissing: true,
            voiceHardRequired: true,
            totalPenalty: 45,
            preConcerns: ['Multiple issues'],
        })

        const result = applyPreCheckPenalties(report, preCheck)
        expect(result.overallScore).toBe(0)
        expect(result.roleFitScore).toBe(0)
    })

    it('should normalise invalid recommendation to MODERATE', () => {
        const report = makeReport({ recommendation: 'INVALID_VALUE' as any })
        const preCheck = makePreCheck()

        const result = applyPreCheckPenalties(report, preCheck)
        expect(result.recommendation).toBe('MODERATE')
    })

    it('should not duplicate concerns already present', () => {
        const existingConcern = 'Age outside range'
        const report = makeReport({ concerns: [existingConcern] })
        const preCheck = makePreCheck({
            ageMismatch: true,
            totalPenalty: 20,
            preConcerns: [existingConcern],
        })

        const result = applyPreCheckPenalties(report, preCheck)
        const count = result.concerns.filter(c => c === existingConcern).length
        expect(count).toBe(1) // not duplicated
    })

    it('should not mutate the original report object', () => {
        const report = makeReport({ overallScore: 80, concerns: ['existing'] })
        const preCheck = makePreCheck({ totalPenalty: 10, preConcerns: ['new concern'] })

        const result = applyPreCheckPenalties(report, preCheck)
        expect(report.overallScore).toBe(80) // original unchanged
        expect(report.concerns).toEqual(['existing']) // original unchanged
        expect(result.overallScore).toBe(70) // new object has penalty applied
    })
})
