/**
 * Formats a contact name with a "(Deleted)" suffix when the contact is soft-deleted.
 * Handles both object-form contacts and pre-formatted name strings.
 */

interface ContactLike {
  first_name: string
  last_name: string
  is_deleted?: boolean
}

/** Format a contact object's name, appending "(Deleted)" when soft-deleted */
export function formatContactName(contact: ContactLike): string {
  const name = `${contact.first_name} ${contact.last_name}`
  return contact.is_deleted ? `${name} (Deleted)` : name
}

/** Append "(Deleted)" to a pre-formatted name string if the contact is deleted */
export function formatNameWithDeletedStatus(
  name: string | null | undefined,
  isDeleted?: boolean
): string {
  if (!name) return '—'
  return isDeleted ? `${name} (Deleted)` : name
}
