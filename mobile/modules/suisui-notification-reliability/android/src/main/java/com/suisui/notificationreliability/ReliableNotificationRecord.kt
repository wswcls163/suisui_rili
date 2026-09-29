package com.suisui.notificationreliability

import org.json.JSONObject

internal data class ReliableNotificationRecord(
  val identifier: String,
  val owner: String,
  val triggerAt: Long,
  val title: String,
  val body: String,
  val kind: String,
  val itemId: String,
  val date: String,
  val fullScreen: Boolean,
) {
  fun toJson() = JSONObject().apply {
    put("identifier", identifier)
    put("owner", owner)
    put("triggerAt", triggerAt)
    put("title", title)
    put("body", body)
    put("kind", kind)
    put("itemId", itemId)
    put("date", date)
    put("fullScreen", fullScreen)
  }

  companion object {
    fun fromJson(value: JSONObject) = ReliableNotificationRecord(
      identifier = value.getString("identifier"),
      owner = value.getString("owner"),
      triggerAt = value.getLong("triggerAt"),
      title = value.getString("title"),
      body = value.getString("body"),
      kind = value.optString("kind"),
      itemId = value.optString("itemId"),
      date = value.optString("date"),
      fullScreen = value.optBoolean("fullScreen", false),
    )
  }
}
