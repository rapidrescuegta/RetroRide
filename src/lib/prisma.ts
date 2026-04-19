/**
 * Backward-compatibility re-export.
 *
 * All 23+ files import `prisma` from '@/lib/prisma'. Rather than updating
 * every import, this module re-exports the singleton from the new db module.
 */
export { prisma } from '@/lib/db'
