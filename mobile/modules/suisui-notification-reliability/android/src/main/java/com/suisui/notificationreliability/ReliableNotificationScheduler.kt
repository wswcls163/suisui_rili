package com.suisui.notificationreliability

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.AlarmManagerCompat

internal class ReliableNotificationScheduler(private val context: Context) {
  private val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
  private val store = ReliableNotificationStore(context)

  fun canScheduleExactAlarms(): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()

  fun replaceProduction(requests: List<ReliableNotificationRecord>): Int {
    val previous = store.all().filter { it.owner == ReliableNotificationStore.OWNER_PRODUCTION }
    previous.forEach { cancelAlarm(it.identifier) }
    store.replaceProduction(requests)
    requests.forEach(::scheduleAlarm)
    return registered(requests).size
  }

  fun clearProduction() {
    store.all()
      .filter { it.owner == ReliableNotificationStore.OWNER_PRODUCTION }
      .forEach {
        cancelAlarm(it.identifier)
        store.remove(it.identifier)
      }
  }

  fun scheduleDiagnostic(request: ReliableNotificationRecord): Boolean {
    cancelAlarm(request.identifier)
    store.putDiagnostic(request)
    scheduleAlarm(request)
    return isRegistered(request.identifier)
  }

  fun restoreAll(now: Long = System.currentTimeMillis()) {
    store.all().forEach { request ->
      if (request.triggerAt < now - MISSED_REMINDER_GRACE_MS) {
        cancelAlarm(request.identifier)
        store.remove(request.identifier)
      } else {
        scheduleAlarm(request, maxOf(request.triggerAt, now + RESTORE_DELAY_MS))
      }
    }
  }

  fun scheduled(): List<ReliableNotificationRecord> = store.all()

  fun registered(requests: List<ReliableNotificationRecord> = store.all()): List<String> =
    requests.map { it.identifier }.filter(::isRegistered)

  fun finishDelivery(identifier: String) {
    pendingIntent(identifier, false)?.cancel()
    store.remove(identifier)
  }

  private fun scheduleAlarm(request: ReliableNotificationRecord, atMillis: Long = request.triggerAt) {
    val operation = pendingIntent(request.identifier, true)
      ?: throw IllegalStateException("Unable to create alarm operation")
    when (ReliableAlarmPolicy.mode(Build.VERSION.SDK_INT, canScheduleExactAlarms())) {
      ReliableAlarmMode.EXACT_ALLOW_WHILE_IDLE -> AlarmManagerCompat.setExactAndAllowWhileIdle(
        alarmManager,
        AlarmManager.RTC_WAKEUP,
        atMillis,
        operation,
      )
      ReliableAlarmMode.ALLOW_WHILE_IDLE -> AlarmManagerCompat.setAndAllowWhileIdle(
        alarmManager,
        AlarmManager.RTC_WAKEUP,
        atMillis,
        operation,
      )
    }
  }

  private fun cancelAlarm(identifier: String) {
    pendingIntent(identifier, false)?.let {
      alarmManager.cancel(it)
      it.cancel()
    }
  }

  private fun isRegistered(identifier: String): Boolean = pendingIntent(identifier, false) != null

  private fun pendingIntent(identifier: String, create: Boolean): PendingIntent? {
    val intent = Intent(context, SuisuiAlarmReceiver::class.java).apply {
      action = ACTION_DELIVER
      data = Uri.Builder()
        .scheme("suisui-reminder")
        .authority("alarm")
        .appendPath(identifier)
        .build()
      putExtra(EXTRA_IDENTIFIER, identifier)
    }
    val behavior = if (create) PendingIntent.FLAG_UPDATE_CURRENT else PendingIntent.FLAG_NO_CREATE
    return PendingIntent.getBroadcast(
      context,
      identifier.hashCode(),
      intent,
      behavior or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  companion object {
    const val ACTION_DELIVER = "com.suisui.calendar.action.DELIVER_RELIABLE_NOTIFICATION"
    const val EXTRA_IDENTIFIER = "identifier"

    private const val MISSED_REMINDER_GRACE_MS = 24 * 60 * 60 * 1000L
    private const val RESTORE_DELAY_MS = 1_500L
  }
}
