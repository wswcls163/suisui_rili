package com.suisui.notificationreliability

internal enum class ReliableAlarmMode {
  EXACT_ALLOW_WHILE_IDLE,
  ALLOW_WHILE_IDLE,
}

internal object ReliableAlarmPolicy {
  fun mode(sdkInt: Int, canScheduleExactAlarms: Boolean): ReliableAlarmMode =
    if (sdkInt < 31 || canScheduleExactAlarms) {
      ReliableAlarmMode.EXACT_ALLOW_WHILE_IDLE
    } else {
      ReliableAlarmMode.ALLOW_WHILE_IDLE
    }
}
