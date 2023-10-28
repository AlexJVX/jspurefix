export interface ITriggeringInstruction {
  TriggerType?: string// [1] 1100 (String)
  TriggerAction?: string// [2] 1101 (String)
  TriggerScope?: number// [3] 1628 (Int)
  TriggerPrice?: number// [4] 1102 (Float)
  TriggerSymbol?: string// [5] 1103 (String)
  TriggerSecurityID?: string// [6] 1104 (String)
  TriggerSecurityIDSource?: string// [7] 1105 (String)
  TriggerSecurityDesc?: string// [8] 1106 (String)
  TriggerPriceType?: string// [9] 1107 (String)
  TriggerPriceTypeScope?: string// [10] 1108 (String)
  TriggerPriceDirection?: string// [11] 1109 (String)
  TriggerNewPrice?: number// [12] 1110 (Float)
  TriggerOrderType?: string// [13] 1111 (String)
  TriggerNewQty?: number// [14] 1112 (Float)
  TriggerTradingSessionID?: string// [15] 1113 (String)
  TriggerTradingSessionSubID?: string// [16] 1114 (String)
}
