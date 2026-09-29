package com.suisui.notificationreliability

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class SuisuiScheduleRestoreReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action !in RESTORE_ACTIONS) return
    val pendingResult = goAsync()
    Thread {
      try {
        ReliableNotificationPublisher(context).ensureChannel()
        ReliableNotificationScheduler(context).restoreAll()
      } finally {
        pendingResult.finish()
      }
    }.start()
  }

  companion object {
    private val RESTORE_ACTIONS = setOf(
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_REBOOT,
      "android.intent.action.QUICKBOOT_POWERON",
      Intent.ACTION_MY_PACKAGE_REPLACED,
    )
  }
}
