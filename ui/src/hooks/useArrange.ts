import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, type ArchivedSlide, type Arranged, type Client, type Deck, type PreviewInfo, type Rebuild } from '../api'
import type { ArrangeActions } from '../components/SlideStrip'

type Args = {
  client: Client
  selected: Deck | null
  preview: PreviewInfo | null
  current: number
  setPreview: React.Dispatch<React.SetStateAction<PreviewInfo | null>>
  setDecks: React.Dispatch<React.SetStateAction<Deck[]>>
  setCurrent: React.Dispatch<React.SetStateAction<number>>
  bumpReload: () => void
  invalidateNotes: () => void
  showRebuild: (rebuild: Rebuild | undefined, path: string) => void
}

export type PickerState = { mode: 'insert' | 'save'; after: string | null; slide?: string }

/**
 * Slide arrangement (reorder / add / duplicate / archive / restore). The
 * backend renames files and answers with the new slide list; the preview keeps
 * its server, only its slide list changes. Also the archive box and the layout
 * picker (insert a template after a slide / save a slide as a template).
 */
export function useArrange({ client, selected, preview, current, setPreview, setDecks, setCurrent, bumpReload, invalidateNotes, showRebuild }: Args) {
  const [arrangeBusy, setArrangeBusy] = useState(false)
  const [arrangeError, setArrangeError] = useState<string | null>(null)
  const [archived, setArchived] = useState<ArchivedSlide[]>([])
  const [archiveOpen, setArchiveOpen] = useState(false)
  useEffect(() => {
    setArchived([])
    setArrangeError(null)
    if (!selected) return
    let alive = true
    void client.slidesArchiveList(selected.path).then((r) => alive && setArchived(r.items)).catch(() => undefined)
    return () => {
      alive = false
    }
  }, [client, selected?.path]) // eslint-disable-line react-hooks/exhaustive-deps
  const applyArranged = useCallback(
    (res: Arranged, focus?: string) => {
      setPreview((p) => (p ? { ...p, slides: res.slides } : p))
      if (selected) setDecks((ds) => ds.map((d) => (d.id === selected.id ? { ...d, slideCount: res.slides.length } : d)))
      bumpReload()
      invalidateNotes()
      if (focus) {
        const i = res.slides.indexOf(focus)
        if (i >= 0) setCurrent(i)
      } else setCurrent((c) => Math.min(c, Math.max(0, res.slides.length - 1)))
      if (selected) showRebuild(res.rebuild, selected.path)
      if (selected) void client.slidesArchiveList(selected.path).then((r) => setArchived(r.items)).catch(() => undefined)
    },
    [client, selected, showRebuild, setPreview, setDecks, setCurrent, bumpReload, invalidateNotes],
  )
  const runArrange = useCallback(
    async (op: () => Promise<Arranged & { name?: string }>, focusFromName = true) => {
      setArrangeBusy(true)
      setArrangeError(null)
      try {
        const res = await op()
        applyArranged(res, focusFromName ? res.name : undefined)
      } catch (e) {
        setArrangeError(e instanceof ApiError ? e.code : 'request_failed')
      } finally {
        setArrangeBusy(false)
      }
    },
    [applyArranged],
  )
  const [picker, setPicker] = useState<PickerState | null>(null)
  useEffect(() => {
    setPicker(null)
  }, [selected?.path])
  const arrangeActions = useMemo<ArrangeActions | undefined>(
    () =>
      selected
        ? {
            busy: arrangeBusy,
            onAdd: (after) => setPicker({ mode: 'insert', after }),
            onDuplicate: (slide) => void runArrange(() => client.slidesAdd(selected.path, slide, true)),
            onSaveLayout: (slide) => setPicker({ mode: 'save', after: slide, slide }),
            onReorder: (order) => {
              const focus = preview?.slides[current]
              const at = focus ? order.indexOf(focus) : -1
              void runArrange(async () => {
                const res = await client.slidesReorder(selected.path, order)
                return { ...res, name: at >= 0 ? res.slides[at] : undefined }
              })
            },
            onArchive: (slide) => void runArrange(() => client.slidesArchive(selected.path, slide), false),
          }
        : undefined,
    [selected, arrangeBusy, preview, current, runArrange, client],
  )
  const restore = useCallback(
    (name: string) => {
      if (!selected) return
      void runArrange(() => client.slidesRestore(selected.path, name, preview?.slides[current] ?? null))
    },
    [client, selected, preview, current, runArrange],
  )
  const insertLayout = useCallback(
    (layoutId: string, after: string | null) => {
      if (!selected) return
      setPicker(null)
      void runArrange(() => client.slidesAdd(selected.path, after, false, layoutId))
    },
    [client, selected, runArrange],
  )

  return { arrangeBusy, arrangeError, archived, archiveOpen, setArchiveOpen, arrangeActions, restore, picker, setPicker, insertLayout }
}
