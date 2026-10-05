package com.suisui.notificationreliability

import org.junit.Assert.assertEquals
import org.junit.Test

class ReliableNotificationCardContentTest {
  @Test
  fun `合并提醒生成今日标签和中文日期`() {
    val content = ReliableNotificationCardContent.from(record(kind = "combined", date = "2026-10-05"))

    assertEquals("今日提醒", content.label)
    assertEquals("10月5日", content.dateBadge)
    assertEquals("今天有多个重要日子", content.title)
  }

  @Test
  fun `不同类型生成对应标签`() {
    assertEquals("生日提醒", ReliableNotificationCardContent.from(record(kind = "birthday")).label)
    assertEquals("纪念日提醒", ReliableNotificationCardContent.from(record(kind = "anniversary")).label)
    assertEquals("节日提醒", ReliableNotificationCardContent.from(record(kind = "festival")).label)
    assertEquals("重要日期", ReliableNotificationCardContent.from(record(kind = "unknown")).label)
  }

  @Test
  fun `无效日期回退为今天`() {
    assertEquals("今天", ReliableNotificationCardContent.from(record(date = "bad-date")).dateBadge)
  }

  private fun record(
    kind: String = "combined",
    date: String = "2026-10-05",
  ) = ReliableNotificationRecord(
    identifier = "preview",
    owner = ReliableNotificationStore.OWNER_DIAGNOSTIC,
    triggerAt = 0,
    title = "今天有多个重要日子",
    body = "妈妈的生日、中秋节。都值得好好记住。",
    kind = kind,
    itemId = "preview",
    date = date,
    fullScreen = false,
  )
}
