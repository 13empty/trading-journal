import type { DailyNote } from '../types/journal'
import type { Translations } from '../i18n/types'

interface Props {
  dayNote: DailyNote
  onSave: (patch: Partial<DailyNote>) => void
  onClose: () => void
  t: Translations['journal']
  tDay: Translations['dayTab']
}

export function DayNotesModal({ dayNote, onSave, onClose, t, tDay }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide day-notes-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t.dailyNotes}</h2>
        <p className="welcome-lead">{tDay.notesModalHint}</p>

        <div className="daily-notes">
          <label>
            <textarea
              rows={4}
              value={dayNote.text}
              onChange={(e) => onSave({ text: e.target.value })}
              placeholder="…"
            />
          </label>
          <div className="notes-row">
            <label>
              {t.whatWorked}
              <input
                type="text"
                value={dayNote.whatWorked}
                onChange={(e) => onSave({ whatWorked: e.target.value })}
              />
            </label>
            <label>
              {t.whatFailed}
              <input
                type="text"
                value={dayNote.whatFailed}
                onChange={(e) => onSave({ whatFailed: e.target.value })}
              />
            </label>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-primary" onClick={onClose}>
            {tDay.notesDone}
          </button>
        </div>
      </div>
    </div>
  )
}
