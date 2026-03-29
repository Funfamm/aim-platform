/**
 * Shared validation utilities for input sanitization and policy enforcement.
 */

interface ValidationResult {
    valid: boolean
    message: string
}

/**
 * Validate a password against the platform's password policy.
 *
 * Rules:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 digit
 */
export function validatePassword(password: string): ValidationResult {
    if (!password || password.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters long' }
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one uppercase letter' }
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one lowercase letter' }
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one digit' }
    }
    return { valid: true, message: 'Password is valid' }
}
