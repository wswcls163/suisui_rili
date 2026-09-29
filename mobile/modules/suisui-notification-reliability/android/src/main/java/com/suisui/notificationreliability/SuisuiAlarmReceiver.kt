package com.suisui.notificationreliability

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class SuisuiAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != ReliableNotificationScheduler.ACTION_DELIVER) return
    val identifier = intent.getStringExtra(ReliableNotificationScheduler.EXTRA_IDENTIFIER) ?: return
    val store = ReliableNotificationStore(context)
    val request = store.all().firstOrNull { it.identifier == identifier } ?: return
    if (ReliableNotificationPublisher(context).post(request)) {
      store.recordDelivery(identifier)
    }
    ReliableNotificationScheduler(context).finishDelivery(identifier)
  }
}
