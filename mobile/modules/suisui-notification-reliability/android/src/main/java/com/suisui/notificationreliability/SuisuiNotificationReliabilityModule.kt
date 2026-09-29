package com.suisui.notificationreliability

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SuisuiNotificationReliabilityModule : Module() {
  private val context: Context
    get() = appContext.reactContext
      ?: throw IllegalStateException("Android application context is unavailable")

  override fun definition() = ModuleDefinition {
    Name("SuisuiNotificationReliability")

    AsyncFunction("canScheduleExactAlarms") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        true
      } else {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.canScheduleExactAlarms()
      }
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
