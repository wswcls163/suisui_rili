package com.suisui.notificationreliability

import org.junit.Assert.assertEquals
import org.junit.Test

class ReliableAlarmPolicyTest {
  @Test
  fun `Android 12 之前始终使用精确空闲闹钟`() {
    assertEquals(
      ReliableAlarmMode.EXACT_ALLOW_WHILE_IDLE,
      ReliableAlarmPolicy.mode(30, false),
    )
  }

  @Test
  fun `Android 12 之后有权限时使用精确空闲闹钟`() {
    assertEquals(
      ReliableAlarmMode.EXACT_ALLOW_WHILE_IDLE,
      ReliableAlarmPolicy.mode(36, true),
    )
  }

  @Test
  fun `Android 12 之后无权限时诚实降级为允许空闲闹钟`() {
    assertEquals(
      ReliableAlarmMode.ALLOW_WHILE_IDLE,
      ReliableAlarmPolicy.mode(36, false),
    )
  }
}
