import { IUnderlyingStreamEffectiveDateBusinessCenterGrp } from './underlying_stream_effective_date_business_center_grp'

export interface IUnderlyingStreamEffectiveDate {
  UnderlyingSettlMethodElectionDateUnadjusted?: Date// 43076
  UnderlyingSettlMethodElectionDateBusinessDayConvention?: number// 43077
  UnderlyingSettlMethodElectionDateRelativeTo?: number// 43078
  UnderlyingSettlMethodElectionDateOffsetPeriod?: number// 43079
  UnderlyingSettlMethodElectionDateOffsetUnit?: string// 43080
  UnderlyingSettlMethodElectionDateOffsetDayType?: number// 43081
  UnderlyingSettlMethodElectionDateAdjusted?: Date// 43082
  UnderlyingStreamEffectiveDateBusinessCenterGrp?: IUnderlyingStreamEffectiveDateBusinessCenterGrp[]
}