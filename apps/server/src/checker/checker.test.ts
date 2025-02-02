import { expect, mock, test } from "bun:test";

import { checkerRetryPolicy } from "./checker";

mock.module("./ping.ts", () => {
  return {
    publishPing: () => {},
  };
});

test("should call updateMonitorStatus when we can fetch", async () => {
  const fn = mock(() => {});

  mock.module("./alerting.ts", () => {
    return {
      updateMonitorStatus: fn,
    };
  });
  await checkerRetryPolicy({
    workspaceId: "1",
    monitorId: "1",
    url: "https://www.google.com",
    cronTimestamp: 1,
    status: "error",
    pageIds: [],
    method: "GET",
  });
  expect(fn).toHaveBeenCalledTimes(1);
});

test("should call updateMonitorStatus when status error", async () => {
  const fn = mock(() => {});

  mock.module("./alerting.ts", () => {
    return {
      updateMonitorStatus: fn,
    };
  });
  try {
    await checkerRetryPolicy({
      workspaceId: "1",
      monitorId: "1",
      url: "https://xxxxxxx.fake",
      cronTimestamp: 1,
      status: "active",
      pageIds: [],
      method: "GET",
    });
  } catch (e) {
    expect(e).toBeInstanceOf(Error);
  }
  expect(fn).toHaveBeenCalledTimes(1);
});

test("What should we do when redirect ", async () => {
  const fn = mock(() => {});

  mock.module("./alerting.ts", () => {
    return {
      updateMonitorStatus: fn,
    };
  });
  try {
    await checkerRetryPolicy({
      workspaceId: "1",
      monitorId: "1",
      url: "https://www.openstatus.dev/toto",
      cronTimestamp: 1,
      status: "active",
      pageIds: [],
      method: "GET",
    });
  } catch (e) {
    expect(e).toBeInstanceOf(Error);
  }
  expect(fn).toHaveBeenCalledTimes(0);
});
