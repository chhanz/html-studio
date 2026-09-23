import { useCallback, useEffect, useMemo, useState } from 'react'
import type { NotesIndex } from '../api'
import { useCollapsed } from '../components/Section'

/** Speaker notes (notes/<slide>.md): which slides have notes, and the panel's open state. */
export function useNotes(selectedPath: string | undefined) {
  const [notesOpen, setNotesOpen] = useCollapsed('notes', false)
  const [notesIndex, setNotesIndex] = useState<NotesIndex | null>(null)
  const [notesRefresh, setNotesRefresh] = useState(0)
  useEffect(() => {
    setNotesIndex(null)
  }, [selectedPath])
  const withNotes = useMemo(() => new Set(notesIndex?.withNotes ?? []), [notesIndex])
  /** Slides changed on disk: forget the index and make the panel re-read its file. */
  const invalidate = useCallback(() => {
    setNotesIndex(null)
    setNotesRefresh((k) => k + 1)
  }, [])
  const bump = useCallback(() => setNotesRefresh((k) => k + 1), [])
  return { notesOpen, setNotesOpen, notesIndex, setNotesIndex, notesRefresh, withNotes, invalidate, bump }
}
