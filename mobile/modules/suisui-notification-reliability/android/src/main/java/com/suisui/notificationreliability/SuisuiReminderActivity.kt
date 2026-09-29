package com.suisui.notificationreliability

import android.app.Activity
import android.app.NotificationManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class SuisuiReminderActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    showAboveLockScreen()
    setContentView(buildContent())
  }

  private fun showAboveLockScreen() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
      )
    }
  }

  private fun buildContent(): LinearLayout {
    val density = resources.displayMetrics.density
    val title = intent.getStringExtra(EXTRA_TITLE) ?: "岁岁日历提醒"
    val body = intent.getStringExtra(EXTRA_BODY) ?: "今天有一个值得记住的日子。"
    val identifier = intent.getStringExtra(EXTRA_IDENTIFIER) ?: "suisui-reminder"
    return LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding((28 * density).toInt(), (40 * density).toInt(), (28 * density).toInt(), (40 * density).toInt())
      setBackgroundColor(Color.rgb(245, 244, 240))
      addView(TextView(context).apply {
        text = "岁岁日历"
        textSize = 16f
        setTextColor(Color.rgb(184, 82, 62))
        gravity = Gravity.CENTER
      }, matchWidth())
      addView(TextView(context).apply {
        text = title
        textSize = 28f
        setTextColor(Color.rgb(35, 48, 51))
        gravity = Gravity.CENTER
        setPadding(0, (24 * density).toInt(), 0, (14 * density).toInt())
      }, matchWidth())
      addView(TextView(context).apply {
        text = body
        textSize = 17f
        setTextColor(Color.rgb(104, 111, 108))
        gravity = Gravity.CENTER
        setLineSpacing(0f, 1.25f)
      }, matchWidth())
      addView(Button(context).apply {
        text = "关闭提醒"
        isAllCaps = false
        setOnClickListener {
          (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
            .cancel(ReliableNotificationPublisher.notificationId(identifier))
          finishAndRemoveTask()
        }
      }, LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
      ).apply { topMargin = (36 * density).toInt() })
    }
  }

  private fun matchWidth() = LinearLayout.LayoutParams(
    ViewGroup.LayoutParams.MATCH_PARENT,
    ViewGroup.LayoutParams.WRAP_CONTENT,
  )

  companion object {
    const val EXTRA_IDENTIFIER = "identifier"
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"
  }
}
