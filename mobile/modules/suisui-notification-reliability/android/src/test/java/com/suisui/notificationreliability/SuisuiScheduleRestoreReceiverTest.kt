package com.suisui.notificationreliability

import android.content.Intent
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SuisuiScheduleRestoreReceiverTest {
  private val packageName = "com.suisui.calendar"

  @Test
  fun `系统启动与本应用更新后恢复提醒`() {
    assertTrue(SuisuiScheduleRestoreReceiver.shouldRestore(Intent.ACTION_BOOT_COMPLETED, null, packageName))
    assertTrue(SuisuiScheduleRestoreReceiver.shouldRestore(Intent.ACTION_MY_PACKAGE_REPLACED, null, packageName))
    assertTrue(SuisuiScheduleRestoreReceiver.shouldRestore(Intent.ACTION_PACKAGE_REPLACED, packageName, packageName))
  }

  @Test
  fun `其他应用更新时不恢复提醒`() {
    assertFalse(
      SuisuiScheduleRestoreReceiver.shouldRestore(
        Intent.ACTION_PACKAGE_REPLACED,
        "com.example.other",
        packageName,
      ),
    )
  }

  @Test
  fun `未知广播不恢复提醒`() {
    assertFalse(SuisuiScheduleRestoreReceiver.shouldRestore("com.example.UNKNOWN", null, packageName))
  }
}
