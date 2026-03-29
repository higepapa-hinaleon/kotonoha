import type { Group, UserGroupMembership } from "~~/shared/types/models";

interface GroupState {
  groups: Group[];
  memberships: UserGroupMembership[];
  activeGroupId: string | null;
  loading: boolean;
  initialized: boolean;
}

const groupState = reactive<GroupState>({
  groups: [],
  memberships: [],
  activeGroupId: null,
  loading: false,
  initialized: false,
});

export function useGroup() {
  const { apiFetch } = useApi();

  async function fetchGroups() {
    groupState.loading = true;
    try {
      const groups = await apiFetch<Group[]>("/api/groups");
      groupState.groups = groups;
      groupState.initialized = true;
    } catch {
      groupState.groups = [];
      const { show } = useNotification();
      show("グループの読み込みに失敗しました", "error");
    } finally {
      groupState.loading = false;
    }
  }

  function setMemberships(memberships: UserGroupMembership[]) {
    groupState.memberships = memberships;
  }

  function setActiveGroupId(groupId: string | null) {
    groupState.activeGroupId = groupId;
  }

  async function switchGroup(groupId: string) {
    try {
      await apiFetch("/api/groups/switch", {
        method: "POST",
        body: { groupId },
      });
      groupState.activeGroupId = groupId;
    } catch {
      // エラーは useApi が処理
    }
  }

  const currentGroup = computed(
    () => groupState.groups.find((g) => g.id === groupState.activeGroupId) || null,
  );

  const hasGroups = computed(() => groupState.memberships.length > 0);

  const currentMembership = computed(
    () => groupState.memberships.find((m) => m.groupId === groupState.activeGroupId) || null,
  );

  const isGroupAdmin = computed(() => {
    const m = currentMembership.value;
    return m?.role === "admin";
  });

  return {
    groups: computed(() => groupState.groups),
    memberships: computed(() => groupState.memberships),
    activeGroupId: computed(() => groupState.activeGroupId),
    currentGroup,
    currentMembership,
    hasGroups,
    isGroupAdmin,
    loading: computed(() => groupState.loading),
    initialized: computed(() => groupState.initialized),
    fetchGroups,
    setMemberships,
    setActiveGroupId,
    switchGroup,
  };
}
