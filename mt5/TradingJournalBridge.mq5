//+------------------------------------------------------------------+
//| TradingJournalBridge.mq5 — Sincroniza trades con Trading Journal |
//| Copiar a: MetaTrader 5/MQL5/Experts/TradingJournalBridge/        |
//+------------------------------------------------------------------+
#property copyright "Trading Journal"
#property version   "1.00"
#property description "Envia trades al Trading Journal (puente en http://127.0.0.1:3847)"

input string BridgeUrl = "http://127.0.0.1:3847/api/event";
input int    HeartbeatSec = 5;
input bool   SyncHistoryOnStart = true;
input int    HistoryDays = 365;
input int    ResyncHistoryMin = 5;

//+------------------------------------------------------------------+
int OnInit()
{
   EventSetTimer(HeartbeatSec);
   if(!SendHeartbeat())
   {
      Print("ERROR: No se pudo conectar al puente. ¿Ejecutaste 'npm run bridge' en trading-journal?");
      Print("¿Añadiste http://127.0.0.1:3847 en Herramientas→Opciones→Asesores Expertos→WebRequest?");
      return(INIT_FAILED);
   }
   Print("OK: Conectado al Trading Journal → ", BridgeUrl);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   static int ticks = 0;
   static datetime lastHistory = 0;
   ticks++;

   SendHeartbeat();

   if(SyncHistoryOnStart)
   {
      int resyncSec = MathMax(1, ResyncHistoryMin) * 60;
      if(ticks == 1 || (TimeCurrent() - lastHistory) >= resyncSec)
      {
         SyncClosedPositions();
         lastHistory = TimeCurrent();
      }
   }
}

void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
{
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD)
   {
      ulong dealTicket = trans.deal;
      if(dealTicket > 0)
         SendDeal(dealTicket);
   }
}

//+------------------------------------------------------------------+
bool SendHeartbeat()
{
   string body = StringFormat(
      "{\"type\":\"heartbeat\",\"account\":%I64d,\"server\":\"%s\",\"balance\":%.2f,\"equity\":%.2f,\"time\":\"%s\"}",
      (long)AccountInfoInteger(ACCOUNT_LOGIN),
      AccountInfoString(ACCOUNT_SERVER),
      AccountInfoDouble(ACCOUNT_BALANCE),
      AccountInfoDouble(ACCOUNT_EQUITY),
      TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS)
   );
   return PostJson(body);
}

//+------------------------------------------------------------------+
void SendDeal(ulong dealTicket)
{
   if(!HistoryDealSelect(dealTicket))
      return;

   long entry = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
   string symbol = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
   long posId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
   double profit = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
   double commission = HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
   double swap = HistoryDealGetDouble(dealTicket, DEAL_SWAP);
   double volume = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
   double price = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
   long dealType = HistoryDealGetInteger(dealTicket, DEAL_TYPE);
   datetime dealTime = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);

   string entryStr = "in";
   if(entry == DEAL_ENTRY_OUT) entryStr = "out";
   else if(entry == DEAL_ENTRY_INOUT) entryStr = "inout";

   string typeStr = (dealType == DEAL_TYPE_SELL) ? "sell" : "buy";

   // Balance / depósito / retiro (sin símbolo)
   if(symbol == "" || HistoryDealGetInteger(dealTicket, DEAL_TYPE) == DEAL_TYPE_BALANCE)
   {
      string comment = HistoryDealGetString(dealTicket, DEAL_COMMENT);
      string balBody = StringFormat(
         "{\"type\":\"balance\",\"account\":%I64d,\"amount\":%.2f,\"comment\":\"%s\",\"time\":\"%s\",\"balance\":%.2f,\"equity\":%.2f}",
         (long)AccountInfoInteger(ACCOUNT_LOGIN),
         profit + commission + swap,
         JsonEscape(comment),
         TimeToString(dealTime, TIME_DATE|TIME_SECONDS),
         AccountInfoDouble(ACCOUNT_BALANCE),
         AccountInfoDouble(ACCOUNT_EQUITY)
      );
      PostJson(balBody);
      return;
   }

   if(entry == DEAL_ENTRY_OUT && posId > 0)
   {
      double posProfit = 0, posComm = 0, posSwap = 0;
      double openPrice = 0, closePrice = price;
      double vol = volume;
      datetime closeTime = dealTime;
      string side = typeStr;

      if(HistorySelectByPosition(posId))
      {
         int total = HistoryDealsTotal();
         for(int i = 0; i < total; i++)
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

      string posBody = StringFormat(
         "{\"type\":\"position_closed\",\"account\":%I64d,\"balance\":%.2f,\"equity\":%.2f,"
         "\"position\":{\"id\":%I64d,\"symbol\":\"%s\",\"side\":\"%s\",\"volume\":%.2f,"
         "\"openPrice\":%.5f,\"closePrice\":%.5f,\"profit\":%.2f,\"commission\":%.2f,\"swap\":%.2f,"
         "\"closeTime\":\"%s\"}}",
         (long)AccountInfoInteger(ACCOUNT_LOGIN),
         AccountInfoDouble(ACCOUNT_BALANCE),
         AccountInfoDouble(ACCOUNT_EQUITY),
         (long)posId,
         symbol,
         side,
         vol,
         openPrice,
         closePrice,
         posProfit,
         posComm,
         posSwap,
         TimeToString(closeTime, TIME_DATE|TIME_SECONDS)
      );
      PostJson(posBody);
      return;
   }

   string dealBody = StringFormat(
      "{\"type\":\"deal\",\"account\":%I64d,\"deal\":{"
      "\"ticket\":%I64u,\"positionId\":%I64d,\"symbol\":\"%s\",\"entry\":\"%s\","
      "\"dealType\":\"%s\",\"volume\":%.2f,\"price\":%.5f,\"profit\":%.2f,"
      "\"commission\":%.2f,\"swap\":%.2f,\"time\":\"%s\"}}",
      (long)AccountInfoInteger(ACCOUNT_LOGIN),
      dealTicket,
      (long)posId,
      symbol,
      entryStr,
      typeStr,
      volume,
      price,
      profit,
      commission,
      swap,
      TimeToString(dealTime, TIME_DATE|TIME_SECONDS)
   );
   PostJson(dealBody);
}

//+------------------------------------------------------------------+
void SyncClosedPositions()
{
   datetime from = TimeCurrent() - HistoryDays * 86400;
   if(!HistorySelect(from, TimeCurrent()))
      return;

   string positions = "[";
   int count = 0;
   int total = HistoryDealsTotal();

   for(int i = 0; i < total; i++)
   {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(!HistoryDealSelect(dealTicket)) continue;
      if(HistoryDealGetInteger(dealTicket, DEAL_ENTRY) != DEAL_ENTRY_OUT) continue;

      long posId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
      if(posId <= 0) continue;

      // Evitar duplicados por posición
      bool dup = false;
      for(int j = i + 1; j < total; j++)
      {
         ulong t2 = HistoryDealGetTicket(j);
         if(!HistoryDealSelect(t2)) continue;
         if(HistoryDealGetInteger(t2, DEAL_POSITION_ID) == posId &&
            HistoryDealGetInteger(t2, DEAL_ENTRY) == DEAL_ENTRY_OUT)
         { dup = true; break; }
      }
      if(dup) continue;

      string symbol = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
      if(symbol == "") continue;

      double posProfit = 0, posComm = 0, posSwap = 0;
      double openPrice = 0, closePrice = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
      double vol = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
      datetime closeTime = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
      string side = "buy";

      if(HistorySelectByPosition(posId))
      {
         int dtotal = HistoryDealsTotal();
         for(int k = 0; k < dtotal; k++)
         {
            ulong t = HistoryDealGetTicket(k);
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

      if(count > 0) positions += ",";
      positions += StringFormat(
         "{\"id\":%I64d,\"symbol\":\"%s\",\"side\":\"%s\",\"volume\":%.2f,"
         "\"openPrice\":%.5f,\"closePrice\":%.5f,\"profit\":%.2f,\"commission\":%.2f,\"swap\":%.2f,"
         "\"closeTime\":\"%s\"}",
         (long)posId, symbol, side, vol, openPrice, closePrice,
         posProfit, posComm, posSwap,
         TimeToString(closeTime, TIME_DATE|TIME_SECONDS)
      );
      count++;
   }
   positions += "]";

   string body = StringFormat(
      "{\"type\":\"history_sync\",\"account\":%I64d,\"balance\":%.2f,\"equity\":%.2f,\"positions\":%s}",
      (long)AccountInfoInteger(ACCOUNT_LOGIN),
      AccountInfoDouble(ACCOUNT_BALANCE),
      AccountInfoDouble(ACCOUNT_EQUITY),
      positions
   );
   PostJson(body);
   Print("Historial sincronizado: ", count, " posiciones");
}

//+------------------------------------------------------------------+
bool PostJson(string body)
{
   char data[];
   char result[];
   string resultHeaders;
   ArrayResize(data, 0);
   ArrayResize(result, 0);
   int len = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(len > 0)
      ArrayResize(data, len - 1);

   int timeout = 10000;
   string headers = "Content-Type: application/json\r\n";

   ResetLastError();
   int code = WebRequest("POST", BridgeUrl, headers, timeout, data, result, resultHeaders);

   if(code == -1)
   {
      int err = GetLastError();
      Print("WebRequest falló. Error ", err);
      Print("1) Ejecuta: npm run bridge");
      Print("2) MT5 → Herramientas → Opciones → Asesores Expertos");
      Print("3) Marca 'Permitir WebRequest' y añade estas URLs:");
      Print("   http://127.0.0.1:3847");
      Print("   http://127.0.0.1");
      Print("4) Reinicia MT5 y vuelve a poner el EA en el gráfico");
      return false;
   }
   if(code != 200)
   {
      Print("Bridge respondió HTTP ", code, " — ¿npm run bridge está corriendo?");
      return false;
   }
   return true;
}

//+------------------------------------------------------------------+
string JsonEscape(string s)
{
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   return s;
}
//+------------------------------------------------------------------+
