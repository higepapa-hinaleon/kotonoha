import { verifyAuth } from "~~/server/utils/auth";
import { getUserGroupMemberships } from "~~/server/utils/group";

export default defineEventHandler(async (event) => {
  const user = await verifyAuth(event);

  // グループメンバーシップ情報を付加して返す
  const memberships = await getUserGroupMemberships(user.id);

  return {
    ...user,
    groupMemberships: memberships,
  };
});
