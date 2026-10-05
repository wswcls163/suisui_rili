package com.suisui.notificationreliability

internal data class ReliableNotificationCardContent(
  val label: String,
  val dateBadge: String,
  val title: String,
  val body: String,
) {
  companion object {
    fun from(request: ReliableNotificationRecord): ReliableNotificationCardContent =
      ReliableNotificationCardContent(
        label = when (request.kind) {
          "birthday" -> "生日提醒"
          "anniversary" -> "纪念日提醒"
          "festival" -> "节日提醒"
          "combined" -> "今日提醒"
          else -> "重要日期"
        },
        dateBadge = dateBadge(request.date),
        title = request.title,
        body = request.body,
      )

    private fun dateBadge(date: String): String {
      val parts = date.split('-')
      val month = parts.getOrNull(1)?.toIntOrNull()
      val day = parts.getOrNull(2)?.toIntOrNull()
      return if (month in 1..12 && day in 1..31) "${month}月${day}日" else "今天"
    }
  }
}
