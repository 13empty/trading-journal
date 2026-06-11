import type { Translations } from '../i18n/types'

interface Props {
  onClose: () => void
  onDismissForever: () => void
  t: Translations['welcome']
}

export function WelcomeModal({ onClose, onDismissForever, t }: Props) {
  return (
    <div className="modal-backdrop welcome-backdrop">
      <div className="modal modal-wide welcome-modal">
        <h2>{t.title}</h2>
        <p className="welcome-lead">{t.lead}</p>

        <div className="welcome-steps">
          <div className="welcome-step">
            <span className="step-num">1</span>
            <div>
              <strong>{t.s1title}</strong>
              <p>{t.s1body}</p>
            </div>
          </div>
          <div className="welcome-step">
            <span className="step-num">2</span>
            <div>
              <strong>{t.s2title}</strong>
              <p>{t.s2body}</p>
            </div>
          </div>
          <div className="welcome-step">
            <span className="step-num">3</span>
            <div>
              <strong>{t.s3title}</strong>
              <p>{t.s3body}</p>
            </div>
          </div>
          <div className="welcome-step">
            <span className="step-num">4</span>
            <div>
              <strong>{t.s4title}</strong>
              <p>{t.s4body}</p>
            </div>
          </div>
        </div>

        <p className="hint-inline">{t.dataNote}</p>

        <div className="modal-actions">
          <button type="button" onClick={onDismissForever}>
            {t.dontShowAgain}
          </button>
          <button type="button" className="btn-primary" onClick={onClose}>
            {t.start}
          </button>
        </div>
      </div>
    </div>
  )
}
