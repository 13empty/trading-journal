//+------------------------------------------------------------------+
//| TradingJournalBridge.mqh — Añadir a TU Expert Advisor existente  |
//| Opción 2: un solo EA hace trading + envía datos al journal         |
//+------------------------------------------------------------------+
#ifndef TJ_BRIDGE_MQH
#define TJ_BRIDGE_MQH

input string TJ_BridgeUrl = "http://127.0.0.1:3847/api/event";

bool TJ_PostJson(const string body)
{
   char data[], result[];
   string headers = "Content-Type: application/json\r\n";
   ArrayResize(data, 0);
   int len = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(len > 0) ArrayResize(data, len - 1);
   ResetLastError();
   int code = WebRequest("POST", TJ_BridgeUrl, headers, 10000, data, result, headers);
   if(code == -1)
   {
      Print("TJ: WebRequest error ", GetLastError(), " — añade ", TJ_BridgeUrl);
      return false;
   }
   return code == 200;
}

void TJ_SendHeartbeat()
{
   string body = StringFormat(
      "{\"type\":\"heartbeat\",\"account\":%I64d,\"balance\":%.2f,\"equity\":%.2f,\"time\":\"%s\"}",
      (long)AccountInfoInteger(ACCOUNT_LOGIN),
      AccountInfoDouble(ACCOUNT_BALANCE),
      AccountInfoDouble(ACCOUNT_EQUITY),
      TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS));
   TJ_PostJson(body);
}

// Llamar desde OnTradeTransaction de tu EA cuando trans.type == TRADE_TRANSACTION_DEAL_ADD
void TJ_OnDealAdded(const ulong dealTicket)
{
   if(!HistoryDealSelect(dealTicket)) return;
   if(HistoryDealGetInteger(dealTicket, DEAL_ENTRY) != DEAL_ENTRY_OUT) return;

   long posId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
   string symbol = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
   if(symbol == "" || posId <= 0) return;

   double posProfit = 0, posComm = 0, posSwap = 0, openPrice = 0, closePrice = 0, vol = 0;
   string side = "buy";
   datetime closeTime = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
   closePrice = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
   vol = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);

   if(HistorySelectByPosition(posId))
   {
      for(int i = 0; i < HistoryDealsTotal(); i++)
      {
         ulong t = HistoryDealGetTicket(i);
         if(!HistoryDealSelect(t)) continue;
         if(HistoryDealGetInteger(t, DEAL_POSITION_ID) != posId) continue;
         posProfit += HistoryDealGetDouble(t, DEAL_PROFIT);
         posComm += HistoryDealGetDouble(t, DEAL_COMMISSION);
         posSwap += HistoryDealGetDouble(t, DEAL_SWAP);
         if(HistoryDealGetInteger(t, DEAL_ENTRY) == DEAL_ENTRY_IN)
         {
            openPrice = HistoryDealGetDouble(t, DEAL_PRICE);
            vol = HistoryDealGetDouble(t, DEAL_VOLUME);
            side = (HistoryDealGetInteger(t, DEAL_TYPE) == DEAL_TYPE_SELL) ? "sell" : "buy";
         }
      }
   }

   string body = StringFormat(
      "{\"type\":\"position_closed\",\"account\":%I64d,\"balance\":%.2f,\"equity\":%.2f,"
      "\"position\":{\"id\":%I64d,\"symbol\":\"%s\",\"side\":\"%s\",\"volume\":%.2f,"
      "\"openPrice\":%.5f,\"closePrice\":%.5f,\"profit\":%.2f,\"commission\":%.2f,\"swap\":%.2f,"
      "\"closeTime\":\"%s\"}}",
      (long)AccountInfoInteger(ACCOUNT_LOGIN),
      AccountInfoDouble(ACCOUNT_BALANCE),
      AccountInfoDouble(ACCOUNT_EQUITY),
      (long)posId, symbol, side, vol, openPrice, closePrice,
      posProfit, posComm, posSwap,
      TimeToString(closeTime, TIME_DATE|TIME_SECONDS));
   TJ_PostJson(body);
}

#endif
