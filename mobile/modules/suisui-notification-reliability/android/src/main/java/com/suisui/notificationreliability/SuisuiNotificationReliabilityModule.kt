package com.suisui.notificationreliability

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject

class SuisuiNotificationReliabilityModule : Module() {
  private val context: Context
    get() = appContext.reactContext
      ?: throw IllegalStateException("Android application context is unavailable")

  override fun definition() = ModuleDefinition {
    Name("SuisuiNotificationReliability")

    AsyncFunction("ensureReliableChannel") {
      ReliableNotificationPublisher(context).ensureChannel()
    }

    AsyncFunction("canScheduleExactAlarms") {
      ReliableNotificationScheduler(context).canScheduleExactAlarms()
    }

    AsyncFunction("canUseFullScreenIntent") {
      ReliableNotificationPublisher(context).canUseFullScreenIntent()
    }

    AsyncFunction("replaceScheduledNotifications") { payloadJson: String, fullScreen: Boolean ->
      val scheduler = ReliableNotificationScheduler(context)
      val requests = parseProductionRequests(payloadJson, fullScreen)
      val registeredCount = scheduler.replaceProduction(requests)
      scheduleResult(requests.size, registeredCount, scheduler.registered(requests))
    }

    AsyncFunction("clearScheduledNotifications") {
      ReliableNotificationScheduler(context).clearProduction()
    }

    AsyncFunction("sendImmediateTestNotification") {
      val now = System.currentTimeMillis()
      val request = ReliableNotificationRecord(
        identifier = "suisui-native-immediate-test",
        owner = ReliableNotificationStore.OWNER_DIAGNOSTIC,
        triggerAt = now,
        title = "岁岁日历横幅测试",
        body = "这是一条立即发送的静默测试通知。",
        kind = "diagnostic-immediate",
        itemId = "",
        date = "",
        fullScreen = false,
      )
      val delivered = ReliableNotificationPublisher(context).post(request)
      if (delivered) ReliableNotificationStore(context).recordDelivery(request.identifier, now)
      JSONObject()
        .put("identifier", request.identifier)
        .put("delivered", delivered)
        .put("deliveredAt", if (delivered) now else 0L)
        .toString()
    }

    AsyncFunction("scheduleDelayedTestNotification") { triggerAt: Double, fullScreen: Boolean ->
      val request = ReliableNotificationRecord(
        identifier = ReliableNotificationStore.TEST_IDENTIFIER,
        owner = ReliableNotificationStore.OWNER_DIAGNOSTIC,
        triggerAt = triggerAt.toLong(),
        title = "岁岁日历锁屏测试",
        body = "如果手机已锁屏，系统会尝试亮屏并显示完整提醒；否则显示顶部横幅。",
        kind = "diagnostic-delayed",
        itemId = "",
        date = "",
        fullScreen = fullScreen,
      )
      val scheduler = ReliableNotificationScheduler(context)
      val registered = scheduler.scheduleDiagnostic(request)
      JSONObject()
        .put("identifier", request.identifier)
        .put("registered", registered)
        .put("triggerAt", request.triggerAt)
        .toString()
    }

    AsyncFunction("getReliableNotificationDiagnostics") {
      diagnosticsJson()
    }

    AsyncFunction("openExactAlarmSettings") {
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        Intent(
          Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
          Uri.parse("package:${context.packageName}"),
        )
      } else {
        appDetailsIntent()
      }
      startSettings(intent)
    }

    AsyncFunction("openFullScreenIntentSettings") {
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        Intent(
          Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
          Uri.parse("package:${context.packageName}"),
        )
      } else {
        appDetailsIntent()
      }
      startSettings(intent)
    }

    AsyncFunction("openNotificationSettings") { channelId: String ->
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).apply {
          putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
          putExtra(Settings.EXTRA_CHANNEL_ID, channelId)
        }
      } else {
        appDetailsIntent()
      }
      startSettings(intent)
    }

    AsyncFunction("openBatterySettings") {
      startSettings(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
    }
  }

  private fun parseProductionRequests(payloadJson: String, fullScreen: Boolean): List<ReliableNotificationRecord> {
    val values = JSONArray(payloadJson)
    require(values.length() <= ReliableNotificationStore.MAX_PRODUCTION_REQUESTS) {
      "At most ${ReliableNotificationStore.MAX_PRODUCTION_REQUESTS} notifications can be scheduled"
    }
    return buildList {
      for (index in 0 until values.length()) {
        val value = values.getJSONObject(index)
        add(
          ReliableNotificationRecord(
            identifier = value.getString("identifier"),
            owner = ReliableNotificationStore.OWNER_PRODUCTION,
            triggerAt = value.getLong("triggerAt"),
            title = value.getString("title"),
            body = value.getString("body"),
            kind = value.optString("kind"),
            itemId = value.optString("itemId"),
            date = value.optString("date"),
            fullScreen = fullScreen,
          ),
        )
      }
    }
  }

  private fun scheduleResult(expectedCount: Int, registeredCount: Int, identifiers: List<String>) =
    JSONObject()
      .put("expectedCount", expectedCount)
      .put("registeredCount", registeredCount)
      .put("identifiers", JSONArray(identifiers))
      .toString()

  private fun diagnosticsJson(): String {
    val publisher = ReliableNotificationPublisher(context)
    publisher.ensureChannel()
    val scheduler = ReliableNotificationScheduler(context)
    val store = ReliableNotificationStore(context)
    val scheduled = scheduler.scheduled()
    val registered = scheduler.registered(scheduled)
    val channel = publisher.channelDiagnostics()
    return JSONObject()
      .put("appNotificationsEnabled", publisher.appNotificationsEnabled())
      .put("exactAlarmAvailable", scheduler.canScheduleExactAlarms())
      .put("fullScreenIntentAvailable", publisher.canUseFullScreenIntent())
      .put("channelExists", channel["exists"])
      .put("channelImportance", channel["importance"])
      .put("channelSoundEnabled", channel["soundEnabled"])
      .put("channelVibrationEnabled", channel["vibrationEnabled"])
      .put("channelLockscreenVisibility", channel["lockscreenVisibility"])
      .put("scheduledCount", scheduled.count { it.owner == ReliableNotificationStore.OWNER_PRODUCTION })
      .put("registeredCount", registered.size)
      .put("registeredIdentifiers", JSONArray(registered))
      .put("lastTestScheduledAt", store.lastTestScheduledAt())
      .put("lastTestTriggerAt", store.lastTestTriggerAt())
      .put("lastDeliveryAt", store.lastDeliveryAt())
      .put("lastDeliveryIdentifier", store.lastDeliveryIdentifier())
      .toString()
  }

  private fun appDetailsIntent() = Intent(
    Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
    Uri.parse("package:${context.packageName}"),
  )

  private fun startSettings(preferred: Intent) {
    val intent = if (preferred.resolveActivity(context.packageManager) != null) {
      preferred
    } else {
      appDetailsIntent()
    }
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }
}
