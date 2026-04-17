import { prisma } from './prisma'

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'REGISTER'
  | 'PASSWORD_CHANGE'
  | 'EMAIL_CHANGE'
  | 'USERNAME_CHANGE'
  | 'ROLE_CHANGE'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_BANNED'
  | 'TRANSLATION_ADDED'
  | 'TRANSLATION_VALIDATED'
  | 'TRANSLATION_DELETED'
  | 'PROPOSAL_ADDED'
  | 'PROPOSAL_UPDATED'
  | 'PROPOSAL_ACCEPTED'
  | 'PROPOSAL_REJECTED'
  | 'PROPOSAL_REOPENED'
  | 'PROPOSAL_DELETED'
  | 'COMMENT_ADDED'
  | 'COMMENT_DELETED'

export async function logAction(
  action: AuditAction,
  userId?: string,
  metadata?: Record<string, string | number | boolean | null>,
  ip?: string,
) {
  try {
    await prisma.auditLog.create({
			data: {
				action,
				user: userId ? { connect: { id: userId } } : undefined,
				metadata: metadata as object,
				ip,
			} as never
		})
  } catch (error) {
    console.error('Erreur lors du log:', error)
  }
}