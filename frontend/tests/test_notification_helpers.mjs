import assert from "node:assert/strict";
import test from "node:test";

test("notification message, href, and read-status normalize both backend and UI shapes", async () => {
  const helpers = await import("../src/lib/notificationHelpers.ts");

  assert.equal(
    helpers.getNotificationMessage({ subtitle: "Expert approved rice blast diagnosis." }),
    "Expert approved rice blast diagnosis.",
  );
  assert.equal(
    helpers.getNotificationMessage({ message: "Direct message", subtitle: "Fallback" }),
    "Direct message",
  );

  assert.equal(helpers.getNotificationHref({ url: "/farmer/result/12" }), "/farmer/result/12");
  assert.equal(
    helpers.getNotificationHref({ link: "/farmer/chat?session=3" }),
    "/farmer/chat?session=3",
  );
  assert.equal(helpers.getNotificationHref({ url: "javascript:alert(1)" }), null);
  assert.equal(helpers.getNotificationHref({ url: "#" }), null);

  assert.equal(helpers.isNotificationRead({ unread: true }), false);
  assert.equal(helpers.isNotificationRead({ unread: false }), true);
  assert.equal(helpers.isNotificationRead({ is_read: true, unread: true }), true);
  assert.equal(helpers.isNotificationRead({ is_read: false, unread: false }), false);
});

test("notification categories and date groups classify items accurately", async () => {
  const helpers = await import("../src/lib/notificationHelpers.ts");

  assert.equal(helpers.getNotificationCategory({ kind: "diagnosis_approved" }), "diagnosis");
  assert.equal(helpers.getNotificationCategory({ kind: "support_chat" }), "messages");
  assert.equal(helpers.getNotificationCategory({ kind: "expert_message" }), "messages");
  assert.equal(helpers.getNotificationCategory({ kind: "premium_upgrade" }), "billing");
  assert.equal(helpers.getNotificationCategory({ kind: "unknown_event" }), "system");

  const fixedNow = new Date(2026, 10, 16, 12, 0, 0);
  const todayIso = new Date(2026, 10, 16, 9, 30, 0).toISOString();
  const yesterdayIso = new Date(2026, 10, 15, 14, 0, 0).toISOString();
  const earlierIso = new Date(2026, 10, 10, 8, 0, 0).toISOString();
  const fiveMinsAgoIso = new Date(fixedNow.getTime() - 5 * 60_000).toISOString();

  assert.equal(helpers.getNotificationDateGroup({ created_at: todayIso }, fixedNow), "today");
  assert.equal(
    helpers.getNotificationDateGroup({ created_at: yesterdayIso }, fixedNow),
    "yesterday",
  );
  assert.equal(
    helpers.getNotificationDateGroup({ created_at: earlierIso }, fixedNow),
    "earlier",
  );

  assert.equal(
    helpers.getNotificationTimeLabel({ created_at: fiveMinsAgoIso }, false, fixedNow),
    "5m ago",
  );
  assert.equal(
    helpers.getNotificationTimeLabel({ created_at: fiveMinsAgoIso }, true, fixedNow),
    "5 នាទីមុន",
  );
});
