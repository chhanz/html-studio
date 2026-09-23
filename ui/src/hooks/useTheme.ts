import { useCallback, useEffect, useState } from 'react'
import { ApiError, type Client, type Deck, type DesignInfo, type PreviewInfo } from '../api'

type Args = {
  client: Client
  selected: Deck | null
  setPreview: (p: PreviewInfo) => void
  setPreviewError: (e: string | null) => void
  bumpReload: () => void
}

/** DESIGN.md recognition (read-only until the user asks for tokens.css) and the theme panel. */
export function useTheme({ client, selected, setPreview, setPreviewError, bumpReload }: Args) {
  const [designInfo, setDesignInfo] = useState<DesignInfo | null>(null)
  const [tokensBusy, setTokensBusy] = useState(false)
  const [tweakOpen, setTweakOpen] = useState(false)
  useEffect(() => {
    if (!selected || !selected.hasDesignMd) {
      setDesignInfo(null)
      return
    }
    let alive = true
    client
      .design(selected.path)
      .then((i) => alive && setDesignInfo(i))
      .catch((e) => {
        console.warn('[html-studio] design failed', e)
        alive && setDesignInfo(null)
      })
    return () => {
      alive = false
    }
  }, [client, selected?.path, selected?.hasDesignMd]) // eslint-disable-line react-hooks/exhaustive-deps
  const writeTokens = useCallback(async () => {
    if (!selected) return
    setTokensBusy(true)
    try {
      const info = await client.writeTokens(selected.path)
      setDesignInfo(info)
      // The backend restarted the preview with the new stylesheet: pick up its port/css.
      const p = await client.previewStart(selected.path)
      setPreview(p)
      bumpReload()
    } catch (e) {
      setPreviewError(e instanceof ApiError ? e.code : 'request_failed')
    } finally {
      setTokensBusy(false)
    }
  }, [client, selected, setPreview, setPreviewError, bumpReload])
  /** After the theme panel applied changes: the preview restarted, DESIGN.md changed. */
  const onApplied = useCallback(() => {
    if (!selected) return
    bumpReload()
    void client.previewStart(selected.path).then(setPreview).catch(() => undefined)
    void client.design(selected.path).then(setDesignInfo).catch(() => undefined)
  }, [client, selected, setPreview, bumpReload])
  return { designInfo, tokensBusy, tweakOpen, setTweakOpen, writeTokens, onApplied }
}
