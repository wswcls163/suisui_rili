package com.suisui.notificationreliability

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.AudioAttributes
import android.os.Build
import android.os.PowerManager
import androidx.core.app.NotificationCompat

internal class ReliableNotificationPublisher(private val context: Context) {
  private val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val attributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
      .build()
    val channel = NotificationChannel(
      CHANNEL_ID,
      "重要日期弹窗",
      NotificationManager.IMPORTANCE_HIGH,
    ).apply {
      description = "节日、生日与周年的静默顶部横幅和可选锁屏全屏提醒"
      enableLights(true)
      lightColor = Color.rgb(184, 82, 62)
      setSound(null, attributes)
      enableVibration(false)
      vibrationPattern = null
      lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
    }
    notificationManager.createNotificationChannel(channel)
  }

  fun canUseFullScreenIntent(): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE || notificationManager.canUseFullScreenIntent()

  fun post(request: ReliableNotificationRecord): Boolean {
    ensureChannel()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && !notificationManager.areNotificationsEnabled()) {
      return false
    }

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(notificationIcon())
      .setColor(Color.rgb(184, 82, 62))
      .setContentTitle(request.title)
      .setContentText(request.body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(request.body))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(if (request.fullScreen) NotificationCompat.CATEGORY_ALARM else NotificationCompat.CATEGORY_REMINDER)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setAutoCancel(true)
      .setContentIntent(contentIntent())

    // 渠道本身已经关闭声音和振动。不要再设置通知级静默，否则 ColorOS 会加上
    // FLAG_SILENT，并把 HIGH 通知实际降为 DEFAULT，导致顶部横幅无法出现。

    if (request.fullScreen && canUseFullScreenIntent()) {
      builder.setFullScreenIntent(fullScreenIntent(request), true)
      wakeScreenBriefly()
    }

    return runCatching {
      notificationManager.notify(notificationId(request.identifier), builder.build())
      true
    }.getOrDefault(false)
  }

  fun channelDiagnostics(): Map<String, Any?> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return mapOf(
        "exists" to true,
        "importance" to NotificationManager.IMPORTANCE_HIGH,
        "soundEnabled" to false,
        "vibrationEnabled" to false,
        "lockscreenVisibility" to NotificationCompat.VISIBILITY_PUBLIC,
      )
    }
    val channel = notificationManager.getNotificationChannel(CHANNEL_ID)
    return mapOf(
      "exists" to (channel != null),
      "importance" to (channel?.importance ?: NotificationManager.IMPORTANCE_NONE),
      "soundEnabled" to (channel?.sound != null),
      "vibrationEnabled" to (channel?.shouldVibrate() == true),
      "lockscreenVisibility" to (channel?.lockscreenVisibility ?: NotificationCompat.VISIBILITY_PRIVATE),
    )
  }

  fun appNotificationsEnabled(): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.N || notificationManager.areNotificationsEnabled()

  private fun contentIntent(): PendingIntent? {
    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: return null
    launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(
      context,
      CONTENT_REQUEST_CODE,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun fullScreenIntent(request: ReliableNotificationRecord): PendingIntent {
    val intent = Intent(context, SuisuiReminderActivity::class.java).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
      putExtra(SuisuiReminderActivity.EXTRA_IDENTIFIER, request.identifier)
      putExtra(SuisuiReminderActivity.EXTRA_TITLE, request.title)
      putExtra(SuisuiReminderActivity.EXTRA_BODY, request.body)
    }
    return PendingIntent.getActivity(
      context,
      request.identifier.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  @Suppress("DEPRECATION")
  private fun wakeScreenBriefly() {
    val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    val lock = powerManager.newWakeLock(
      PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
      "suisui:notification-screen",
    )
    lock.acquire(WAKE_LOCK_TIMEOUT_MS)
  }

  private fun notificationIcon(): Int {
    val metadata = runCatching {
      context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA).metaData
    }.getOrNull()
    return metadata?.getInt("expo.modules.notifications.default_notification_icon", 0)
      ?.takeIf { it != 0 }
      ?: context.applicationInfo.icon.takeIf { it != 0 }
      ?: android.R.drawable.ic_dialog_info
  }

  companion object {
    const val CHANNEL_ID = "important-dates-popup-v3"
    private const val CONTENT_REQUEST_CODE = 7_310
    private const val WAKE_LOCK_TIMEOUT_MS = 10_000L

    fun notificationId(identifier: String): Int = identifier.hashCode() and 0x7fffffff
  }
}
