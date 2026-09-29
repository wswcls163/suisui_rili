package com.suisui.notificationreliability

import android.content.Context
import org.json.JSONArray

internal class ReliableNotificationStore(context: Context) {
  private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

  @Synchronized
  fun all(): List<ReliableNotificationRecord> {
    val stored = preferences.getString(KEY_REQUESTS, null) ?: return emptyList()
    return runCatching {
      val values = JSONArray(stored)
      buildList {
        for (index in 0 until values.length()) {
          add(ReliableNotificationRecord.fromJson(values.getJSONObject(index)))
        }
      }
    }.getOrElse { emptyList() }
  }

  @Synchronized
  fun replaceProduction(requests: List<ReliableNotificationRecord>) {
    require(requests.size <= MAX_PRODUCTION_REQUESTS) {
      "At most $MAX_PRODUCTION_REQUESTS production notifications can be scheduled"
    }
    val diagnostics = all().filter { it.owner != OWNER_PRODUCTION }
    save(diagnostics + requests)
  }

  @Synchronized
  fun putDiagnostic(request: ReliableNotificationRecord) {
    save(all().filterNot { it.identifier == request.identifier } + request)
    preferences.edit()
      .putLong(KEY_LAST_TEST_SCHEDULED_AT, System.currentTimeMillis())
      .putLong(KEY_LAST_TEST_TRIGGER_AT, request.triggerAt)
      .apply()
  }

  @Synchronized
  fun remove(identifier: String) {
    save(all().filterNot { it.identifier == identifier })
  }

  @Synchronized
  fun recordDelivery(identifier: String, deliveredAt: Long = System.currentTimeMillis()) {
    preferences.edit()
      .putLong(KEY_LAST_DELIVERY_AT, deliveredAt)
      .putString(KEY_LAST_DELIVERY_IDENTIFIER, identifier)
      .apply()
  }

  fun lastTestScheduledAt(): Long = preferences.getLong(KEY_LAST_TEST_SCHEDULED_AT, 0L)

  fun lastTestTriggerAt(): Long = preferences.getLong(KEY_LAST_TEST_TRIGGER_AT, 0L)

  fun lastDeliveryAt(): Long = preferences.getLong(KEY_LAST_DELIVERY_AT, 0L)

  fun lastDeliveryIdentifier(): String = preferences.getString(KEY_LAST_DELIVERY_IDENTIFIER, "") ?: ""

  private fun save(requests: List<ReliableNotificationRecord>) {
    val values = JSONArray()
    requests.forEach { values.put(it.toJson()) }
    preferences.edit().putString(KEY_REQUESTS, values.toString()).commit()
  }

  companion object {
    const val OWNER_PRODUCTION = "suisui-calendar"
    const val OWNER_DIAGNOSTIC = "suisui-calendar-diagnostic"
    const val MAX_PRODUCTION_REQUESTS = 60
    const val TEST_IDENTIFIER = "suisui-native-delayed-test"

    private const val PREFERENCES_NAME = "suisui-reliable-notifications-v1"
    private const val KEY_REQUESTS = "requests"
    private const val KEY_LAST_TEST_SCHEDULED_AT = "last-test-scheduled-at"
    private const val KEY_LAST_TEST_TRIGGER_AT = "last-test-trigger-at"
    private const val KEY_LAST_DELIVERY_AT = "last-delivery-at"
    private const val KEY_LAST_DELIVERY_IDENTIFIER = "last-delivery-identifier"
  }
}
