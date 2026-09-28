import { useEffect, useState } from 'react'
import type { Translations } from '../i18n/types'
import { checkAppUpdates, subscribeAppUpdates } from '../lib/appUpdates'
import {
  downloadUpdateDesktop,
  installUpdateDesktop,
  subscribeUpdateStatus,
  type UpdateStatus,
} from '../lib/desktop'

interface Props {
  t: Translations['updates']
}

function openDownload(status: Extract<UpdateStatus, { state: 'available' }>) {
  const url = status.downloadUrl || status.url
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  void downloadUpdateDesktop()
}

export function UpdateBanner({ t }: Props) {
  const [github, setGithub] = useState<UpdateStatus>({ state: 'idle' })
  const [desktop, setDesktop] = useState<UpdateStatus>({ state: 'idle' })

  useEffect(() => {
    const unsubGithub = subscribeAppUpdates(setGithub)
    const unsubDesktop = subscribeUpdateStatus(setDesktop)
    void checkAppUpdates(false)
    return () => {
      unsubGithub()
      unsubDesktop()
    }
  }, [])

  const status: UpdateStatus =
    desktop.state === 'downloading' || desktop.state === 'ready' || desktop.state === 'available'
      ? desktop
      : github

  if (
    status.state === 'idle' ||
    status.state === 'disabled' ||
    status.state === 'checking' ||
    status.state === 'current'
  ) {
    return null
  }

  if (status.state === 'error') {
    return (
      <div className="update-banner warn">
        <span>{t.error}</span>
        <button type="button" className="btn-ghost-sm" onClick={() => void checkAppUpdates(true)}>
          {t.retry}
        </button>
      </div>
    )
  }

  if (status.state === 'available') {
    const notes = status.notes || (github.state === 'available' ? github.notes : '')
    return (
      <div className="update-banner update-banner-notes">
        <div className="update-banner-copy">
          <strong>{t.available.replace('{version}', status.version)}</strong>
          {notes ? <pre className="update-notes">{notes}</pre> : null}
        </div>
        <button type="button" className="btn-primary btn-sm" onClick={() => openDownload(status)}>
          {t.download}
        </button>
      </div>
    )
  }

  if (status.state === 'downloading') {
    return (
      <div className="update-banner">
        <span>
          {t.downloading} {status.percent}%
        </span>
      </div>
    )
  }

  if (status.state === 'ready') {
    return (
      <div className="update-banner ready update-banner-notes">
        <div className="update-banner-copy">
          <strong>{t.ready.replace('{version}', status.version)}</strong>
          {status.notes ? <pre className="update-notes">{status.notes}</pre> : null}
        </div>
        <button type="button" className="btn-primary btn-sm" onClick={() => void installUpdateDesktop()}>
          {t.install}
        </button>
      </div>
    )
  }

  return null
}
