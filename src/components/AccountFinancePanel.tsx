import type { AccountSummary } from '../types/account'
import type { Translations } from '../i18n/types'
import { formatMoney, formatBalance, pnlClass } from '../lib/aggregations'

interface Props {
  account: AccountSummary
  t: Translations['finance']
  mismatchHint?: string
}

export function AccountFinancePanel({ account, t, mismatchHint }: Props) {
  return (
    <section className="panel analytics-section deductions-panel">
      <h3>{t.title}</h3>
      <ul className="deductions-list">
        <li>
          <span>{t.depositsIn}</span>
          <span className="positive">+${account.totalDeposits.toFixed(2)}</span>
        </li>
        <li>
          <span>{t.withdrawalsOut}</span>
          <span className="cash-out">${account.totalWithdraws.toFixed(2)}</span>
        </li>
        <li>
          <span>{t.netDeposits}</span>
          <span>{formatBalance(account.netCashIn)}</span>
        </li>
        <li className="sep">
          <span>{t.accountProfit}</span>
          <span className={pnlClass(account.accountProfit)}>
            {formatMoney(account.accountProfit)}
          </span>
        </li>
        <li className="hint-row">
          <span className="hint-text">{t.balanceFormula}</span>
        </li>
      </ul>
      <h4 className="sub-head">{t.tradeDeductions}</h4>
      <ul className="deductions-list">
        <li>
          <span>{t.swap}</span>
          <span className="negative">−${account.swap.toFixed(2)}</span>
        </li>
        <li>
          <span>{t.transfersOut}</span>
          <span className="negative">−${account.transfersOut.toFixed(2)}</span>
        </li>
        <li>
          <span>{t.closedPnlMt5}</span>
          <span className={pnlClass(account.mt5NetProfit)}>
            {formatMoney(account.mt5NetProfit)}
          </span>
        </li>
      </ul>
      {mismatchHint && <p className="hint-inline">{mismatchHint}</p>}
    </section>
  )
}
