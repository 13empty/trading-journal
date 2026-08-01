import { desktopNotify } from './desktop'

export function pruneNotifyKeys(active: Set<string>, store: Set<string>): void {
  for (const key of store) {
    if (!active.has(key)) store.delete(key)
  }
}

export function notifyOnce(
  store: Set<string>,
  key: string,
  title: string,
  body: string,
  enabled: boolean,
): void {
  if (!enabled || store.has(key)) return
  store.add(key)
  void desktopNotify(title, body, true)
}
