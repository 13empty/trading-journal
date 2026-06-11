import { useEffect, useState } from 'react'
import type { Translations } from '../i18n/types'
import {
  checkForUpdatesDesktop,
  downloadUpdateDesktop,
  installUpdateDesktop,
  subscribeUpdateStatus,
  type UpdateStatus,
} from '../lib/desktop'

interface Props {
  t: Translations['updates']
}

export function UpdateBanner({ t }: Props) {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })

  useEffect(() => {
    const unsub = subscribeUpdateStatus(setStatus)
    return unsub
  }, [])

  if (status.state === 'idle' || status.state === 'disabled' || status.state === 'checking') {
    return null
  }

  if (status.state === 'error') {
    return (
      <div className="update-banner warn">
        <span>{t.error}</span>
        <button type="button" className="btn-ghost-sm" onClick={() => void checkForUpdatesDesktop()}>
          {t.retry}
        </button>
      </div>
    )
  }

  if (status.state === 'available') {
    return (
      <div className="update-banner">
        <span>{t.available.replace('{version}', status.version)}</span>
        <button type="button" className="btn-primary btn-sm" onClick={() => void downloadUpdateDesktop()}>
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
      <div className="update-banner ready">
        <span>{t.ready.replace('{version}', status.version)}</span>
        <button type="button" className="btn-primary btn-sm" onClick={() => void installUpdateDesktop()}>
          {t.install}
        </button>
      </div>
    )
  }

  return null
}
