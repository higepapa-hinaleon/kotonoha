import {
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import type { User, UserGroupMembership, Application } from "~~/shared/types/models";

interface AuthState {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  initializing: boolean;
  initialized: boolean;
  pendingApplication: Application | null;
  pendingApplicationFetched: boolean;
}

const authState = reactive<AuthState>({
  firebaseUser: null,
  user: null,
  loading: false,
  initializing: true,
  initialized: false,
  pendingApplication: null,
  pendingApplicationFetched: false,
});

// 明示的な signup/login 中に onAuthStateChanged の fetchUser を抑制するフラグ
let explicitAuthInProgress = false;

export function useAuth() {
  const { $auth } = useNuxtApp();

  // Firebase Auth 状態変更の監視（初回のみ）
  if (!authState.initialized) {
    authState.initialized = true;
    onAuthStateChanged($auth, async (firebaseUser) => {
      authState.firebaseUser = firebaseUser;
      if (firebaseUser) {
        // 明示的な signup/login 中は fetchUser を呼ばない（呼び出し元が options 付きで呼ぶため）
        if (!explicitAuthInProgress) {
          await fetchUser();
        }
      } else {
        authState.user = null;
      }
      if (!explicitAuthInProgress) {
        authState.initializing = false;
      }
    });
  }

  async function getIdToken(): Promise<string> {
    if (!authState.firebaseUser) throw new Error("未認証です");
    return authState.firebaseUser.getIdToken();
  }

  function initializeUserGroups(userData: User, groupMemberships?: UserGroupMembership[]) {
    const { setMemberships, setActiveGroupId, fetchGroups, groups } = useGroup();
    if (groupMemberships) {
      setMemberships(groupMemberships);
    }
    if (userData.activeGroupId) {
      setActiveGroupId(userData.activeGroupId);
    }
    return async () => {
      await fetchGroups();
      // owner / system_admin / org_admin: グループ未選択時に最初のグループを自動選択
      if ((userData.role === "owner" || userData.role === "system_admin" || userData.role === "org_admin") && !userData.activeGroupId && groups.value.length > 0) {
        setActiveGroupId(groups.value[0].id);
      }
    };
  }

  async function fetchUser(options?: { organizationName?: string }) {
    try {
      const token = await getIdToken();
      const data = await $fetch<User & { groupMemberships?: UserGroupMembership[] }>(
        "/api/auth/me",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const { groupMemberships, ...userData } = data;
      authState.user = userData;
      const completeInit = initializeUserGroups(userData, groupMemberships);
      await completeInit();
    } catch {
      // ユーザーがFirestoreに未登録の場合、自動登録
      try {
        const token = await getIdToken();
        const data = await $fetch<User & { groupMemberships?: UserGroupMembership[] }>(
          "/api/auth/register",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            ...(options?.organizationName ? { body: { organizationName: options.organizationName } } : {}),
          },
        );
        const { groupMemberships, ...userData } = data;
        authState.user = userData;
        const completeInit = initializeUserGroups(userData, groupMemberships);
        await completeInit();
      } catch {
        authState.user = null;
        authState.initializing = false;
      }
    }
  }

  async function signupWithEmail(email: string, password: string, options?: { organizationName?: string }) {
    authState.loading = true;
    explicitAuthInProgress = true;
    try {
      const credential = await createUserWithEmailAndPassword($auth, email, password);
      authState.firebaseUser = credential.user;
      await fetchUser(options);
    } finally {
      explicitAuthInProgress = false;
      authState.initializing = false;
      authState.loading = false;
    }
  }

  async function loginWithEmail(email: string, password: string) {
    authState.loading = true;
    explicitAuthInProgress = true;
    try {
      const credential = await signInWithEmailAndPassword($auth, email, password);
      authState.firebaseUser = credential.user;
      await fetchUser();
    } finally {
      explicitAuthInProgress = false;
      authState.initializing = false;
      authState.loading = false;
    }
  }

  async function loginWithGoogle(options?: { organizationName?: string }) {
    authState.loading = true;
    explicitAuthInProgress = true;
    try {
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup($auth, provider);
      authState.firebaseUser = credential.user;
      await fetchUser(options);
    } finally {
      explicitAuthInProgress = false;
      authState.initializing = false;
      authState.loading = false;
    }
  }

  async function fetchPendingApplication(forceRefresh = false) {
    if (authState.pendingApplicationFetched && !forceRefresh) return authState.pendingApplication;
    try {
      const token = await getIdToken();
      const data = await $fetch<{ application: Application | null }>("/api/applications/mine", {
        headers: { Authorization: `Bearer ${token}` },
      });
      authState.pendingApplication = data.application ?? null;
    } catch {
      authState.pendingApplication = null;
    }
    authState.pendingApplicationFetched = true;
    return authState.pendingApplication;
  }

  function invalidatePendingApplicationCache() {
    authState.pendingApplicationFetched = false;
    authState.pendingApplication = null;
  }

  async function logout() {
    await signOut($auth);
    authState.firebaseUser = null;
    authState.user = null;
    authState.pendingApplication = null;
    authState.pendingApplicationFetched = false;
    const { setMemberships, setActiveGroupId } = useGroup();
    setMemberships([]);
    setActiveGroupId(null);
    await navigateTo("/login");
  }

  return {
    user: computed(() => authState.user),
    firebaseUser: computed(() => authState.firebaseUser),
    loading: computed(() => authState.loading),
    initializing: computed(() => authState.initializing),
    isAdmin: computed(() => {
      const user = authState.user;
      if (!user) return false;
      if (user.role === "owner" || user.role === "system_admin" || user.role === "org_admin") return true;
      // グループレベルの admin チェック
      const { isGroupAdmin } = useGroup();
      return isGroupAdmin.value;
    }),
    isSystemAdmin: computed(() => {
      const role = authState.user?.role;
      return role === "system_admin" || role === "owner";
    }),
    isOrgAdmin: computed(() => {
      const role = authState.user?.role;
      return role === "org_admin" || role === "system_admin" || role === "owner";
    }),
    isOwner: computed(() => authState.user?.role === "owner"),
    hasConsent: computed(() => !!authState.user?.consentAcceptedAt),
    hasOrganization: computed(() => !!authState.user?.organizationId),
    isAuthenticated: computed(() => !!authState.user),
    pendingApplication: computed(() => authState.pendingApplication),
    hasPendingApplication: computed(() => !!authState.pendingApplication),
    getIdToken,
    signupWithEmail,
    loginWithEmail,
    loginWithGoogle,
    fetchPendingApplication,
    invalidatePendingApplicationCache,
    fetchUser,
    logout,
  };
}
