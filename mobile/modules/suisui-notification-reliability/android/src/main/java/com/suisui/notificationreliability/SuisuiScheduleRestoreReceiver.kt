package com.suisui.notificationreliability

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class SuisuiScheduleRestoreReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (!shouldRestore(intent.action, intent.data?.schemeSpecificPart, context.packageName)) return
    val pendingResult = goAsync()
    Thread {
      try {
        ReliableNotificationPublisher(context).ensureChannel()
        val restoredCount = ReliableNotificationScheduler(context).restoreAll()
        Log.i(TAG, "Restored $restoredCount reliable notification alarms after ${intent.action}")
      } catch (error: Throwable) {
        Log.e(TAG, "Unable to restore reliable notification alarms after ${intent.action}", error)
      } finally {
        pendingResult.finish()
      }
    }.start()
  }

  companion object {
    private const val TAG = "SuisuiReminderRestore"

    private val RESTORE_ACTIONS = setOf(
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_REBOOT,
      "android.intent.action.QUICKBOOT_POWERON",
      Intent.ACTION_MY_PACKAGE_REPLACED,
    )

    internal fun shouldRestore(action: String?, replacedPackage: String?, ownPackage: String): Boolean =
      action in RESTORE_ACTIONS ||
        (action == Intent.ACTION_PACKAGE_REPLACED && replacedPackage == ownPackage)
  }
}
