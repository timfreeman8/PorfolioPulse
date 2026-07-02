/**
 * LoginPage — the entry point for all users.
 *
 * Users select their name from the member roster. Role is automatically
 * determined by whether their member ID appears in adminMemberIds (Settings →
 * Access Control). This simulates what Azure AD will do when real
 * authentication is added: map the AAD user to a member ID and derive the
 * role from group membership.
 *
 * Bootstrap mode: when no admins have been configured yet (adminMemberIds is
 * empty), every sign-in receives admin access so the first user can get in
 * and configure the admin list via Settings → Access Control.
 *
 * When Azure AD (MSAL) replaces this page:
 *   1. Remove the member picker and the Sign In button.
 *   2. Add <MsalAuthenticationTemplate> to trigger the AAD redirect.
 *   3. In the callback, map the AAD user's email/UPN to a member ID and
 *      call useAuthStore.login(memberId, role) with the AAD-derived role.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Shield, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePortfolioStore } from '@/store/usePortfolioStore'
import { useAuthStore, type UserRole } from '@/store/useAuthStore'
import { cn } from '@/lib/utils'

export function LoginPage() {
  const { members, adminMemberIds } = usePortfolioStore()
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const [selectedId, setSelectedId] = useState('')

  // Members sorted alphabetically so the list is easy to scan.
  const sortedMembers = [...members].sort((a, b) => a.name.localeCompare(b.name))

  /**
   * Bootstrap mode: if no admins have been configured yet, every login gets
   * admin access so the initial setup can be done without being locked out.
   */
  const isBootstrap = adminMemberIds.length === 0

  // Determine what role the selected member would receive.
  const role: UserRole = selectedId
    ? (isBootstrap || adminMemberIds.includes(selectedId) ? 'admin' : 'viewer')
    : 'viewer'

  const selectedMember = members.find(m => m.id === selectedId) ?? null

  function handleSignIn() {
    if (members.length === 0) {
      // No roster yet — bootstrap admin login so the user can set up the org.
      // '__admin_bootstrap__' won't match any member; TopBar will fall back to "Admin".
      login('__admin_bootstrap__', 'admin')
      navigate('/', { replace: true })
      return
    }
    if (!selectedId) return
    login(selectedId, role)
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">

      {/* Brand — matches TopBar logo + wordmark */}
      <div className="flex items-center gap-3 mb-10">
        <svg className="h-10 w-auto shrink-0" viewBox="0 0 180 181" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Kroger">
          <path d="M68.781 148.605C68.7498 150.922 68.0341 153.178 66.724 155.089C65.414 157 63.568 158.481 61.4184 159.345C59.2688 160.21 56.9115 160.419 54.6431 159.948C52.3747 159.476 50.2965 158.344 48.6699 156.694C47.0434 155.044 45.9411 152.949 45.5017 150.675C45.0624 148.4 45.3056 146.046 46.2007 143.909C47.0959 141.772 48.603 139.947 50.5326 138.664C52.4621 137.382 54.7279 136.698 57.0448 136.7C58.6 136.701 60.1394 137.011 61.5738 137.612C63.0082 138.213 64.309 139.093 65.4007 140.2C66.4925 141.308 67.3535 142.621 67.9337 144.064C68.514 145.507 68.802 147.05 68.781 148.605Z" fill="#0F52A2"/>
          <path d="M154.209 160.5C160.697 160.5 165.956 155.175 165.956 148.606C165.956 142.036 160.697 136.711 154.209 136.711C147.722 136.711 142.463 142.036 142.463 148.606C142.463 155.175 147.722 160.5 154.209 160.5Z" fill="#0F52A2"/>
          <path d="M56.3373 70.5086C56.2921 70.1302 56.327 69.7466 56.4399 69.3825C56.5527 69.0185 56.7409 68.6824 56.9923 68.3959C57.2416 68.1081 57.5498 67.8771 57.8961 67.7185C58.2423 67.56 58.6185 67.4776 58.9994 67.4769H90.8487C91.3223 67.4768 91.7873 67.603 92.1958 67.8425C92.6044 68.0821 92.9416 68.4262 93.1727 68.8396C93.406 69.254 93.5285 69.7215 93.5285 70.197C93.5285 70.6725 93.406 71.14 93.1727 71.5544L76.7674 100.351C76.5985 100.661 76.37 100.934 76.095 101.155C75.82 101.376 75.504 101.54 75.1652 101.638C74.8264 101.736 74.4715 101.766 74.121 101.727C73.7705 101.687 73.4313 101.579 73.1229 101.407C72.9732 101.322 72.8318 101.223 72.7004 101.111C63.9852 93.6087 58.238 83.2385 56.4958 71.8713C56.4535 71.5122 56.4007 71.0368 56.3373 70.5086ZM107.867 112.351C100.045 113.092 92.1629 111.842 84.9542 108.717C84.6025 108.566 84.287 108.342 84.0284 108.06C83.7698 107.777 83.5741 107.443 83.4542 107.08C83.3347 106.715 83.2927 106.329 83.3309 105.947C83.3691 105.565 83.4866 105.196 83.676 104.862L102.691 71.5544C102.922 71.1409 103.259 70.7965 103.667 70.5568C104.076 70.317 104.541 70.1906 105.015 70.1906C105.488 70.1906 105.953 70.317 106.362 70.5568C106.77 70.7965 107.108 71.1409 107.339 71.5544L125.709 103.795C125.893 104.113 126.01 104.466 126.053 104.831C126.096 105.197 126.063 105.567 125.957 105.92C125.851 106.272 125.674 106.599 125.437 106.88C125.2 107.161 124.908 107.391 124.578 107.555C119.353 110.176 113.686 111.803 107.867 112.351ZM140.096 95.1536C138.931 96.5722 137.686 97.923 136.367 99.1995C136.082 99.487 135.735 99.7052 135.352 99.837C134.969 99.9689 134.561 100.011 134.16 99.9601C133.755 99.9014 133.37 99.751 133.033 99.5203C132.696 99.2895 132.417 98.9846 132.216 98.629L116.782 71.5439C116.544 71.1312 116.419 70.663 116.419 70.1864C116.419 69.7099 116.544 69.2417 116.782 68.829C117.014 68.4157 117.351 68.0715 117.759 67.832C118.168 67.5924 118.633 67.4662 119.106 67.4663H148.04C148.423 67.4669 148.8 67.5492 149.148 67.7077C149.496 67.8662 149.806 68.0972 150.058 68.3853C150.305 68.6745 150.49 69.011 150.603 69.3743C150.716 69.7375 150.753 70.1199 150.713 70.4981C149.574 79.5545 145.893 88.1031 140.096 95.1536Z" fill="#0F52A2"/>
          <path d="M160.187 67.4659C158.307 94.9314 136.947 117.833 109.049 120.443C78.0654 123.337 50.4943 100.129 47.6421 68.6808C45.0541 40.2857 26.7895 21.7888 0.00012207 20.5V40.2857C16.5745 41.5005 26.6099 52.1698 28.279 70.4977C31.9023 110.354 65.0827 140.387 103.851 140.387C106.168 140.387 108.51 140.278 110.876 140.059C148.905 136.51 177.828 104.988 179.73 67.4343L160.187 67.4659Z" fill="#0F52A2"/>
        </svg>
        <div className="flex flex-col leading-tight">
          <span className="font-semibold text-xl text-slate-900 dark:text-slate-100 leading-tight">
            Portfolio Pulse
          </span>
          <span className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 leading-none">
            {import.meta.env.VITE_APP_TAG ?? 'Beta'}
          </span>
        </div>
      </div>

      {/* Login card */}
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden">

        {/* Card header bar — matches the TopBar blue */}
        <div className="px-8 py-5 bg-[rgb(15,82,162)] dark:bg-[#0a1628]">
          <h1 className="text-lg font-semibold text-white">Sign in</h1>
          <p className="text-blue-200 text-sm mt-0.5">
            Store Technology · Internal use only
          </p>
        </div>

        <div className="px-8 py-7 space-y-5">

          {/* Bootstrap mode notice — shown when no admins are configured */}
          {isBootstrap && (
            <div className="flex gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
              <Shield size={14} className="shrink-0 mt-0.5" />
              <span>
                No admins configured yet. Your first sign-in will grant admin
                access. Set up the admin list in{' '}
                <strong>Settings → Access Control</strong>.
              </span>
            </div>
          )}

          {/* Member selector */}
          <div className="space-y-1.5">
            <label htmlFor="member-select" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Who are you?
            </label>
            {members.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 italic py-2">
                No members in the roster yet. Sign in to add people.
              </p>
            ) : (
              <select
                id="member-select"
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                className={cn(
                  'w-full rounded-md border px-3 py-2 text-sm',
                  'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100',
                  'border-slate-200 dark:border-slate-600',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                )}
              >
                <option value="">Select your name…</option>
                {sortedMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            )}

            {/* Role preview — shows what access the selected member will receive */}
            {selectedMember && (
              <div className="flex items-center gap-1.5 mt-1">
                {role === 'admin' ? (
                  <>
                    <Shield size={12} className="text-blue-600 dark:text-blue-400" />
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      Administrator — full access
                    </span>
                  </>
                ) : (
                  <>
                    <Eye size={12} className="text-slate-500 dark:text-slate-400" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Viewer — read-only, filtered to your projects
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Sign in button */}
          <Button
            onClick={handleSignIn}
            disabled={!selectedId && members.length > 0}
            className="w-full"
          >
            <LogIn size={15} className="mr-1.5" />
            {/* If roster is empty, allow signing in as admin to bootstrap the org */}
            {members.length === 0 ? 'Sign in as Administrator' : 'Sign In'}
          </Button>

          {/* When roster is empty, we still need to let someone log in to set up the org */}
          {members.length === 0 && (
            <p className="text-xs text-slate-400 text-center">
              You'll be able to add members after signing in.
            </p>
          )}

        </div>
      </div>

      {/* Future auth note */}
      <p className="mt-8 text-xs text-slate-400 dark:text-slate-600 text-center max-w-xs">
        Azure AD single sign-on will replace this screen when authentication is enabled.
      </p>
    </div>
  )
}

// ─── Empty-roster bootstrap ───────────────────────────────────────────────
/**
 * When the member roster is empty (first launch before seed data or initial
 * setup), LoginPage renders a "Sign in as Administrator" button that calls
 * login with a synthetic admin userId of '__bootstrap__'. This gives the
 * admin access to the People page to add members and configure the org.
 *
 * The bootstrap ID is handled in useAuthStore: login('__bootstrap__', 'admin')
 * sets activeMemberId = null (admin mode), so all gating works normally.
 * The TopBar will show "Admin" as the display name since no member matches.
 */
